import { v4 as uuidv4 } from 'uuid';
import * as yaml from 'js-yaml';
import * as Entities from '../entities'
import { TOSCA_Node_Template, TOSCA_Relationship_Template, TOSCA_Requirement_Assignment, TOSCA_Service_Template, TOSCA_Topology_Template } from '@/totypa/tosca-types/template-types';
import { UniqueKeyManager } from './UniqueKeyManager';
import { BACKING_DATA_TOSCA_KEY } from '../entities/backingData';
import { flatMetaData, readMetaData, readToscaMetaData } from '../common/entityDataTypes';
import { DATA_AGGREGATE_TOSCA_KEY } from '../entities/dataAggregate';
import { INFRASTRUCTURE_TOSCA_KEY } from '../entities/infrastructure';
import { EntityProperty } from '../common/entityProperty';
import { TOSCA_Property_Assignment } from '@/totypa/tosca-types/core-types';
import { TwoWayKeyIdMap } from './TwoWayKeyIdMap';
import { SERVICE_TOSCA_KEY } from '../entities/service';
import { BACKING_SERVICE_TOSCA_KEY } from '../entities/backingService';
import { STORAGE_BACKING_SERVICE_TOSCA_KEY } from '../entities/storageBackingService';
import { COMPONENT_TOSCA_KEY } from '../entities/component';
import { ENDPOINT_TOSCA_KEY } from '../entities/endpoint';
import { EXTERNAL_ENDPOINT_TOSCA_KEY } from '../entities/externalEndpoint';
import { DEPLOYMENT_MAPPING_TOSCA_KEY } from '../entities/deploymentMapping';
import { LINK_TOSCA_KEY } from '../entities/link';
import { REQUEST_TRACE_TOSCA_KEY } from '../entities/requestTrace';

const TOSCA_DEFINITIONS_VERSION = "tosca_simple_yaml_1_3"

const MATCH_WHITESPACES = new RegExp(/\s/g);
const MATCH_UNWANTED_CHARACTERS = new RegExp(/[#>\-\.]/g);
const MATCH_UNDERSCORE = new RegExp(/_/g);
const MATCH_MULTIPLE_UNDERSCORES = new RegExp(/_+/g);
const MATCH_FIRST_CHARACTER = new RegExp(/^./g);
const MATCH_CHARACTER_AFTER_SPACE = new RegExp(/(\s)(.)/g);

export function convertToServiceTemplate(systemEntity: Entities.System): TOSCA_Service_Template {

    const uniqueKeyManager = new UniqueKeyManager();
    const keyIdMap = new TwoWayKeyIdMap();

    let serviceTemplate: TOSCA_Service_Template = {
        tosca_definitions_version: TOSCA_DEFINITIONS_VERSION,
        metadata: {
            template_author: "CNA modeling tool",
            template_name: systemEntity.getSystemName,
            template_version: "0.1.0" // TODO customize
        },
        description: "Service template generated by the CNA modeling tool"
    }

    let topologyTemplate: TOSCA_Topology_Template = {
        description: "Topology template generated by the CNA modeling tool",
        node_templates: {},
        relationship_templates: {}
    };

    for (const [id, dataAggregate] of systemEntity.getDataAggregateEntities.entries()) {
        const nodeKey: string = uniqueKeyManager.ensureUniqueness(transformToYamlKey(dataAggregate.getName));
        let node = createDataAggregateTemplate(dataAggregate);
        keyIdMap.add(nodeKey, id);
        topologyTemplate.node_templates[nodeKey] = node;
    }

    for (const [id, backingData] of systemEntity.getBackingDataEntities.entries()) {
        const nodeKey: string = uniqueKeyManager.ensureUniqueness(transformToYamlKey(backingData.getName));
        let node = createBackingDataTemplate(backingData);
        keyIdMap.add(nodeKey, id);
        topologyTemplate.node_templates[nodeKey] = node;
    }

    for (const [id, infrastructure] of systemEntity.getInfrastructureEntities.entries()) {
        const nodeKey: string = uniqueKeyManager.ensureUniqueness(transformToYamlKey(infrastructure.getName));
        let node = createInfrastructureTemplate(infrastructure);
        if (infrastructure.getBackingDataEntities.length > 0) {
            node.requirements = [];
            for (const usedBackingData of infrastructure.getBackingDataEntities) {
                node.requirements.push({ "uses_backing_data": keyIdMap.getKey(usedBackingData.getId) });
            }
        }
        keyIdMap.add(nodeKey, id);
        topologyTemplate.node_templates[nodeKey] = node;
    }


    for (const [id, component] of systemEntity.getComponentEntities.entries()) {
        const nodeKey: string = uniqueKeyManager.ensureUniqueness(transformToYamlKey(component.getName));
        let node = createComponentTemplate(component);

        if (component.getEndpointEntities.length > 0) {
            node.requirements = [];
            for (const endpoint of component.getEndpointEntities) {
                const endpointNodeKey = uniqueKeyManager.ensureUniqueness(transformToYamlKey(endpoint.getName))
                let endpointNode = createEndpointTemplate(endpoint);

                keyIdMap.add(endpointNodeKey, endpoint.getId);
                topologyTemplate.node_templates[endpointNodeKey] = endpointNode;
                node.requirements.push({
                    "provides_endpoint": {
                        capability: "tosca.capabilities.Endpoint",
                        node: endpointNodeKey,
                        relationship: {
                            type: "cna.qualityModel.relationships.Provides.Endpoint",
                        }
                    } as TOSCA_Requirement_Assignment
                });
            }
        }

        if (component.getExternalEndpointEntities.length > 0) {
            if (!node.requirements) {
                node.requirements = [];
            }
            for (const externalEndpoint of component.getExternalEndpointEntities) {
                const endpointNodeKey = uniqueKeyManager.ensureUniqueness(transformToYamlKey(externalEndpoint.getName))
                let endpointNode = createExternalEndpointTemplate(externalEndpoint);

                keyIdMap.add(endpointNodeKey, externalEndpoint.getId);
                topologyTemplate.node_templates[endpointNodeKey] = endpointNode;
                node.requirements.push({
                    "provides_external_endpoint": {
                        capability: "tosca.capabilities.Endpoint.Public",
                        node: endpointNodeKey,
                        relationship: {
                            type: "cna.qualityModel.relationships.Provides.Endpoint",
                        }
                    } as TOSCA_Requirement_Assignment
                });
            }
        }

        if (component.getDataAggregateEntities.length > 0) {
            if (!node.requirements) {
                node.requirements = [];
            }
            for (const usedDataAggregate of component.getDataAggregateEntities) {
                // TODO save data usage relation
                node.requirements.push({ "uses_data": keyIdMap.getKey(usedDataAggregate.data.getId) });
            }
        }

        if (component.getBackingDataEntities.length > 0) {
            if (!node.requirements) {
                node.requirements = [];
            }
            for (const usedBackingData of component.getBackingDataEntities) {
                node.requirements.push({ "uses_backing_data": keyIdMap.getKey(usedBackingData.getId) });
            }
        }

        keyIdMap.add(nodeKey, id);
        topologyTemplate.node_templates[nodeKey] = node;
    }

    for (const [id, deploymentMapping] of systemEntity.getDeploymentMappingEntities.entries()) {
        const hostNodeKey = keyIdMap.getKey(deploymentMapping.getUnderlyingInfrastructure.getId);
        const hostedNodeKey = keyIdMap.getKey(deploymentMapping.getDeployedEntity.getId);
        const deploymentRelationshipKey = uniqueKeyManager.ensureUniqueness(`${hostNodeKey}_hosts_${hostedNodeKey}`);

        let relationship: TOSCA_Relationship_Template = {
            type: DEPLOYMENT_MAPPING_TOSCA_KEY
        }

        keyIdMap.add(deploymentRelationshipKey, id);
        topologyTemplate.relationship_templates[deploymentRelationshipKey] = relationship;

        let hostedNodeTemplate = topologyTemplate.node_templates[hostedNodeKey];

        if (!hostedNodeTemplate.requirements) {
            hostedNodeTemplate.requirements = [];
        }

        hostedNodeTemplate.requirements.push({
            "host": {
                node: hostNodeKey,
                relationship: deploymentRelationshipKey
            }
        })
    }

    for (const [id, link] of systemEntity.getLinkEntities.entries()) {
        const targetNodeKey = keyIdMap.getKey(link.getTargetEndpoint.getId);
        const sourceNodeKey = keyIdMap.getKey(link.getSourceEntity.getId);
        const linkRelationshipKey = uniqueKeyManager.ensureUniqueness(`${sourceNodeKey}_linksTo_${targetNodeKey}`);

        let relationship: TOSCA_Relationship_Template = {
            type: LINK_TOSCA_KEY
        }

        keyIdMap.add(linkRelationshipKey, id);
        topologyTemplate.relationship_templates[linkRelationshipKey] = relationship;

        let sourceNodeTemplate = topologyTemplate.node_templates[sourceNodeKey];

        if (!sourceNodeTemplate.requirements) {
            sourceNodeTemplate.requirements = [];
        }

        sourceNodeTemplate.requirements.push({
            "endpoint_link": {
                node: targetNodeKey,
                relationship: linkRelationshipKey
            }
        })
    }

    for (const [id, requestTrace] of systemEntity.getRequestTraceEntities.entries()) {
        const nodeKey = uniqueKeyManager.ensureUniqueness(transformToYamlKey(requestTrace.getName));
        let node = createRequestTraceTemplate(requestTrace, systemEntity, keyIdMap);

        topologyTemplate.node_templates[nodeKey] = node;
    }

    serviceTemplate.topology_template = topologyTemplate;
    return serviceTemplate;
}

function transformToYamlKey(name: string) {

    // 1. no leading or trailing whitespaces 
    // 2. replace whitespaces with underscore
    // 3. replace # > - . with underscore
    // 4. ensure no subsequent underscores

    return name.trim()
        .replace(MATCH_WHITESPACES, "_")
        .replace(MATCH_UNWANTED_CHARACTERS, "_")
        .replace(MATCH_MULTIPLE_UNDERSCORES, "_")
        .toLocaleLowerCase();
}

function parsePropertiesForYaml(properties: EntityProperty[]): { [propertyKey: string]: TOSCA_Property_Assignment | string } {
    let yamlProperties: { [propertyKey: string]: TOSCA_Property_Assignment | string } = {};
    for (const property of properties) {
        yamlProperties[property.getKey] = property.value
    }
    return yamlProperties;
}


function createDataAggregateTemplate(dataAggregate: Entities.DataAggregate): TOSCA_Node_Template {
    return {
        type: DATA_AGGREGATE_TOSCA_KEY,
        metadata: flatMetaData(dataAggregate.getMetaData),
    }
}


function createBackingDataTemplate(backingData: Entities.BackingData): TOSCA_Node_Template {

    let template: TOSCA_Node_Template = {
        type: BACKING_DATA_TOSCA_KEY,
        metadata: flatMetaData(backingData.getMetaData),
    }

    if (backingData.getIncludedData.length > 0) {
        let includedData = {};
        for (const data of backingData.getIncludedData) {
            includedData[data.key] = data.value;
        }
        template.properties = {
            "includedData": includedData
        }
    }

    return template;
}

function createInfrastructureTemplate(infrastructure: Entities.Infrastructure): TOSCA_Node_Template {

    let template: TOSCA_Node_Template = {
        type: INFRASTRUCTURE_TOSCA_KEY,
        metadata: flatMetaData(infrastructure.getMetaData),
    }

    if (infrastructure.getProperties().length > 0) {
        template.properties = parsePropertiesForYaml(infrastructure.getProperties());
    }

    return template;
}

function createComponentTemplate(component: Entities.Component): TOSCA_Node_Template {

    let typeKey = (() => {
        switch (component.constructor) {
            case Entities.Service:
                return SERVICE_TOSCA_KEY;
            case Entities.BackingService:
                return BACKING_SERVICE_TOSCA_KEY;
            case Entities.StorageBackingService:
                return STORAGE_BACKING_SERVICE_TOSCA_KEY;
            case Entities.Component:
            default:
                return COMPONENT_TOSCA_KEY;
        }
    })();

    let template: TOSCA_Node_Template = {
        type: typeKey,
        metadata: flatMetaData(component.getMetaData),
    }

    let properties = parsePropertiesForYaml(component.getProperties());
    if (isNonEmpty(properties)) {
        template.properties = properties;
    }

    return template;
}


function createEndpointTemplate(endpoint: Entities.Endpoint): TOSCA_Node_Template {
    let template: TOSCA_Node_Template = {
        type: ENDPOINT_TOSCA_KEY,
        metadata: flatMetaData(endpoint.getMetaData),
    };

    template.capabilities = {
        "endpoint": {
            properties: parsePropertiesForYaml(endpoint.getProperties())
        }
    }
    return template;
}

function createExternalEndpointTemplate(endpoint: Entities.ExternalEndpoint): TOSCA_Node_Template {
    let template: TOSCA_Node_Template = {
        type: EXTERNAL_ENDPOINT_TOSCA_KEY,
        metadata: flatMetaData(endpoint.getMetaData),
    };

    template.capabilities = {
        "external_endpoint": {
            properties: parsePropertiesForYaml(endpoint.getProperties())
        }
    }
    return template;
}

function createRequestTraceTemplate(requestTrace: Entities.RequestTrace, systemEntity: Entities.System, keyIdMap: TwoWayKeyIdMap) {

    let template: TOSCA_Node_Template = {
        type: REQUEST_TRACE_TOSCA_KEY,
        metadata: flatMetaData(requestTrace.getMetaData),
        properties: {
            nodes: [],
            links: []
        }
    }

    let nodeKeys = new Set<string>();
    for (const link of requestTrace.getLinks) {
        template.properties.links.push(keyIdMap.getKey(link.getId));
        nodeKeys.add(keyIdMap.getKey(link.getSourceEntity.getId));
        let targetComponent = systemEntity.searchComponentOfEndpoint(link.getTargetEndpoint.getId);
        if (targetComponent) {
            nodeKeys.add(keyIdMap.getKey(targetComponent.getId));
        }
    }
    template.properties.nodes.push(...nodeKeys);

    template.properties.external_endpoint = keyIdMap.getKey(requestTrace.getExternalEndpoint.getId)

    return template;
}


function isNonEmpty(obj) {
    for (const prop in obj) {
        if (Object.hasOwn(obj, prop) && obj[prop]) {
            return true;
        }
    }
    return false;
}

export function importFromServiceTemplate(fileName: string, stringifiedServiceTemplate: string): Entities.System {

    const serviceTemplate: TOSCA_Service_Template = yaml.load(stringifiedServiceTemplate) as TOSCA_Service_Template;
    const topologyTemplate = serviceTemplate.topology_template;

    let systemName = fileName.replace(/\..*$/g, "");
    let importedSystem = new Entities.System(systemName);

    let keyIdMap = new TwoWayKeyIdMap();


    // start with DataAggregates and BackingData
    for (const [key, node] of Object.entries(topologyTemplate.node_templates)) {
        if (node.type === DATA_AGGREGATE_TOSCA_KEY) {
            let uuid = uuidv4();
            let dataAggregate = new Entities.DataAggregate(uuid, transformYamlKeyToLabel(key), readToscaMetaData(node.metadata))
            importedSystem.addEntity(dataAggregate);
            keyIdMap.add(key, uuid);
        } else if (node.type === BACKING_DATA_TOSCA_KEY) {
            let uuid = uuidv4();

            let includedData = [];
            if (node.properties && node.properties["includedData"]) {
                for (const [key, value] of Object.entries(node.properties["includedData"])) {
                    includedData.push({ key: key, value: value });
                }
            }
            let backingData = new Entities.BackingData(uuid, transformYamlKeyToLabel(key), readToscaMetaData(node.metadata), includedData)
            importedSystem.addEntity(backingData);
            keyIdMap.add(key, uuid);
        }
    }

    // continue with Infrastructure
    for (const [key, node] of Object.entries(topologyTemplate.node_templates)) {
        if (node.type === INFRASTRUCTURE_TOSCA_KEY) {
            let uuid = uuidv4();
            let infrastructure = new Entities.Infrastructure(uuid, transformYamlKeyToLabel(key), readToscaMetaData(node.metadata), "compute"); // TODO: what to do with infrastructure type?

            if (node.requirements) {
                for (const requirementAssignment of node.requirements) {
                    for (const [requirementKey, requirement] of Object.entries(requirementAssignment)) {
                        if (requirementKey === "uses_backing_data") { // TODO no hard coded Key
                            if (typeof requirement === "string") {
                                infrastructure.addBackingDataEntity(importedSystem.getBackingDataEntities.get(keyIdMap.getId(requirement)));
                            } else {
                                // TODO requirement is of type TOSCA_Requirement_Assignment
                            }
                        }
                    }
                }
            }

            if (node.properties) {
                for (const [key, value] of Object.entries(node.properties)) {
                    infrastructure.setPropertyValue(key, value);
                }
            }

            importedSystem.addEntity(infrastructure);
            keyIdMap.add(key, uuid);
        }

    }


    let endpoints: Map<string, Entities.Endpoint> = new Map();
    // continue with Endpoints
    for (const [key, node] of Object.entries(topologyTemplate.node_templates)) {
        if (node.type === ENDPOINT_TOSCA_KEY) {
            let uuid = uuidv4();
            let endpoint = new Entities.Endpoint(uuid, transformYamlKeyToLabel(key), readToscaMetaData(node.metadata));
            if (node.properties) {
                for (const [key, value] of Object.entries(node.properties)) {
                    endpoint.setPropertyValue(key, value);
                }
            }
            if (node.capabilities && node.capabilities["endpoint"] && node.capabilities["endpoint"].properties) {
                for (const [key, value] of Object.entries(node.capabilities["endpoint"].properties)) {
                    endpoint.setPropertyValue(key, value);
                }
            }
            endpoints.set(uuid, endpoint);
            keyIdMap.add(key, uuid);
        } else if (node.type === EXTERNAL_ENDPOINT_TOSCA_KEY) {
            let uuid = uuidv4();
            let externalEndpoint = new Entities.ExternalEndpoint(uuid, transformYamlKeyToLabel(key), readToscaMetaData(node.metadata));
            if (node.properties) {
                for (const [key, value] of Object.entries(node.properties)) {
                    externalEndpoint.setPropertyValue(key, value);
                }
            }
            if (node.capabilities && node.capabilities["external_endpoint"] && node.capabilities["external_endpoint"].properties) {
                for (const [key, value] of Object.entries(node.capabilities["external_endpoint"].properties)) {
                    externalEndpoint.setPropertyValue(key, value);
                }
            }
            endpoints.set(uuid, externalEndpoint);
            keyIdMap.add(key, uuid);
        }
    }

    // continue with components
    for (const [key, node] of Object.entries(topologyTemplate.node_templates)) {
        if (node.type === SERVICE_TOSCA_KEY) {
            let uuid = uuidv4();
            let service = new Entities.Service(uuid, transformYamlKeyToLabel(key), readToscaMetaData(node.metadata));

            parseRequirements(node, service, importedSystem, endpoints, keyIdMap);

            if (node.properties) {
                for (const [key, value] of Object.entries(node.properties)) {
                    service.setPropertyValue(key, value);
                }
            }

            keyIdMap.add(key, uuid);
            importedSystem.addEntity(service);
        } else if (node.type === BACKING_SERVICE_TOSCA_KEY) {
            let uuid = uuidv4();
            let backingService = new Entities.BackingService(uuid, transformYamlKeyToLabel(key), readToscaMetaData(node.metadata));

            parseRequirements(node, backingService, importedSystem, endpoints, keyIdMap);

            if (node.properties) {
                for (const [key, value] of Object.entries(node.properties)) {
                    backingService.setPropertyValue(key, value);
                }
            }

            keyIdMap.add(key, uuid);
            importedSystem.addEntity(backingService);
        } else if (node.type === STORAGE_BACKING_SERVICE_TOSCA_KEY) {
            let uuid = uuidv4();
            let storageBackingService = new Entities.StorageBackingService(uuid, transformYamlKeyToLabel(key), readToscaMetaData(node.metadata));

            parseRequirements(node, storageBackingService, importedSystem, endpoints, keyIdMap);

            if (node.properties) {
                for (const [key, value] of Object.entries(node.properties)) {
                    storageBackingService.setPropertyValue(key, value);
                }
            }

            keyIdMap.add(key, uuid);
            importedSystem.addEntity(storageBackingService);
        } else if (node.type === COMPONENT_TOSCA_KEY) {
            let uuid = uuidv4();
            let component = new Entities.Component(uuid, transformYamlKeyToLabel(key), readToscaMetaData(node.metadata));

            parseRequirements(node, component, importedSystem, endpoints, keyIdMap);

            if (node.properties) {
                for (const [key, value] of Object.entries(node.properties)) {
                    component.setPropertyValue(key, value);
                }
            }

            keyIdMap.add(key, uuid);
            importedSystem.addEntity(component);
        }
    }

    // finally add request traces
    for (const [key, node] of Object.entries(topologyTemplate.node_templates)) {
        if (node.type === REQUEST_TRACE_TOSCA_KEY) {
            let uuid = uuidv4();

            let externalEndpoint = node.properties && node.properties["external_endpoint"] ? endpoints.get(keyIdMap.getId(node.properties["external_endpoint"])) : null; // TODO something better than null?
            let links = node.properties && node.properties["links"] ? node.properties["links"].map(linkKey => importedSystem.getLinkEntities.get(keyIdMap.getId(linkKey))) : [];

            let requestTrace = new Entities.RequestTrace(uuid, transformYamlKeyToLabel(key), readToscaMetaData(node.metadata), externalEndpoint, links);

            // TODO handle additional properties

            keyIdMap.add(key, uuid);
            importedSystem.addEntity(requestTrace);
        }
    }

    return importedSystem;
}

function transformYamlKeyToLabel(key: string) {

    // 1. replace underscore with whitespace
    // 2. make first character uppercase
    // 3. make all characters after a space uppercase

    return key.replace(MATCH_UNDERSCORE, " ").replace(MATCH_FIRST_CHARACTER, (match) => match.toUpperCase()).replace(MATCH_CHARACTER_AFTER_SPACE, (match, p1, p2) => `${p1}${p2.toUpperCase()}`)
}


function parseRequirements(node: TOSCA_Node_Template, component: Entities.Component, importedSystem: Entities.System, endpoints: Map<string, Entities.Endpoint>, keyIdMap: TwoWayKeyIdMap) {
    if (node.requirements) {
        for (const requirementAssignment of node.requirements) {
            for (const [requirementKey, requirement] of Object.entries(requirementAssignment)) {
                switch (requirementKey) {
                    case "uses_data":
                        if (typeof requirement === "string") {
                            component.addDataEntity(importedSystem.getDataAggregateEntities.get(keyIdMap.getId(requirement))); //TODO handle usageRelation
                        } else {
                            // TODO requirement is of type TOSCA_Requirement_Assignment
                        }
                        break;
                    case "uses_backing_data":
                        if (typeof requirement === "string") {
                            component.addDataEntity(importedSystem.getBackingDataEntities.get(keyIdMap.getId(requirement)));
                        } else {
                            // TODO requirement is of type TOSCA_Requirement_Assignment
                        }
                        break;
                    case "provides_endpoint":
                        if (typeof requirement === "string") {
                            // TODO requirement is of type string
                        } else {
                            component.addEndpoint(endpoints.get(keyIdMap.getId(requirement.node)));
                        }
                        break;
                    case "provides_external_endpoint":
                        if (typeof requirement === "string") {
                            // TODO requirement is of type string
                        } else {
                            component.addEndpoint(endpoints.get(keyIdMap.getId(requirement.node)));
                        }
                        break;
                    case "host":
                        if (typeof requirement === "string") {
                            // TODO requirement is of type string
                        } else {
                            let linkId = uuidv4();
                            let deploymentMapping = new Entities.DeploymentMapping(linkId, component, importedSystem.getInfrastructureEntities.get(keyIdMap.getId(requirement.node)));
                            keyIdMap.add(requirement.relationship as string, linkId) // TODO requirement.relationship is object
                            importedSystem.addEntity(deploymentMapping);
                        }
                        break;
                    case "endpoint_link":
                        if (typeof requirement === "string") {
                            // TODO requirement is of type string
                        } else {
                            let linkId = uuidv4();
                            let link = new Entities.Link(linkId, component, endpoints.get(keyIdMap.getId(requirement.node)));
                            keyIdMap.add(requirement.relationship as string, linkId) // TODO requirement.relationship is object
                            importedSystem.addEntity(link);
                            // TODO add to Component (includedLinks?)
                        }
                        break;
                }
            }
        }
    }
}