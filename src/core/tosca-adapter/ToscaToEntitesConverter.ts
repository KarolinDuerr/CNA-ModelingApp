import { v4 as uuidv4 } from 'uuid';
import { TOSCA_Node_Template, TOSCA_Service_Template, TOSCA_Topology_Template } from '@/totypa/tosca-types/template-types';
import * as Entities from '../entities'
import { TwoWayKeyIdMap } from "./TwoWayKeyIdMap";
import { DATA_AGGREGATE_TOSCA_KEY } from '../entities/dataAggregate';
import { BACKING_DATA_TOSCA_KEY } from '../entities/backingData';
import { DataUsageRelation, readToscaMetaData } from '../common/entityDataTypes';
import { DEPLOYMENT_MAPPING_TOSCA_KEY } from '../entities/deploymentMapping';
import { LINK_TOSCA_KEY } from '../entities/link';
import { INFRASTRUCTURE_TOSCA_KEY } from '../entities/infrastructure';
import { ENDPOINT_TOSCA_KEY } from '../entities/endpoint';
import { EXTERNAL_ENDPOINT_TOSCA_KEY } from '../entities/externalEndpoint';
import { SERVICE_TOSCA_KEY } from '../entities/service';
import { BACKING_SERVICE_TOSCA_KEY } from '../entities/backingService';
import { STORAGE_BACKING_SERVICE_TOSCA_KEY } from '../entities/storageBackingService';
import { COMPONENT_TOSCA_KEY } from '../entities/component';
import { REQUEST_TRACE_TOSCA_KEY } from '../entities/requestTrace';

const MATCH_UNDERSCORE = new RegExp(/_/g);
const MATCH_FIRST_CHARACTER = new RegExp(/^./g);
const MATCH_CHARACTER_AFTER_SPACE = new RegExp(/(\s)(.)/g);

class ToscaToEntitesConverter {

    #keyIdMap = new TwoWayKeyIdMap();

    #importedSystem: Entities.System;

    #serviceTemplate: TOSCA_Service_Template;
    #topologyTemplate: TOSCA_Topology_Template;

    constructor(serviceTemplate: TOSCA_Service_Template, systemName: string) {
        this.#serviceTemplate = serviceTemplate;
        this.#topologyTemplate = this.#serviceTemplate.topology_template;
        this.#importedSystem = new Entities.System(systemName);
    }

    convert(): Entities.System {

        // start with DataAggregates and BackingData
        for (const [key, node] of Object.entries(this.#topologyTemplate.node_templates)) {
            if (node.type === DATA_AGGREGATE_TOSCA_KEY) {
                let uuid = uuidv4();
                let dataAggregate = new Entities.DataAggregate(uuid, this.#transformYamlKeyToLabel(key), readToscaMetaData(node.metadata))

                if (node.properties) {
                    for (const [key, value] of Object.entries(node.properties)) {
                        dataAggregate.setPropertyValue(key, value);
                    }
                }

                this.#importedSystem.addEntity(dataAggregate);
                this.#keyIdMap.add(key, uuid);
            } else if (node.type === BACKING_DATA_TOSCA_KEY) {
                let uuid = uuidv4();
                let backingData = new Entities.BackingData(uuid, this.#transformYamlKeyToLabel(key), readToscaMetaData(node.metadata));

                if (node.properties) {
                    for (const [key, value] of Object.entries(node.properties)) {
                        backingData.setPropertyValue(key, value);
                    }
                }

                this.#importedSystem.addEntity(backingData);
                this.#keyIdMap.add(key, uuid);
            }
        }

        // continue with Infrastructure
        for (const [key, node] of Object.entries(this.#topologyTemplate.node_templates)) {
            if (node.type === INFRASTRUCTURE_TOSCA_KEY) {
                let uuid = uuidv4();
                let infrastructure = new Entities.Infrastructure(uuid, this.#transformYamlKeyToLabel(key), readToscaMetaData(node.metadata));

                if (node.requirements) {
                    for (const requirementAssignment of node.requirements) {
                        for (const [requirementKey, requirement] of Object.entries(requirementAssignment)) {
                            if (requirementKey === "uses_backing_data") { // TODO no hard coded Key
                                if (typeof requirement === "string") {
                                    infrastructure.addBackingDataEntity(this.#importedSystem.getBackingDataEntities.get(this.#keyIdMap.getId(requirement)), "");
                                } else if (typeof requirement === "object") {
                                    if (requirement.node && requirement.relationship && typeof requirement.relationship === "string") {
                                        let relationship = this.#topologyTemplate.relationship_templates[requirement.relationship];
                                        let usageRelation: DataUsageRelation = relationship.properties && relationship.properties["usage_relation"] ? relationship.properties["usage_relation"] : "";
                                        infrastructure.addBackingDataEntity(this.#importedSystem.getBackingDataEntities.get(this.#keyIdMap.getId(requirement.node)), usageRelation);
                                    }
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

                this.#importedSystem.addEntity(infrastructure);
                this.#keyIdMap.add(key, uuid);
            }

        }


        let endpoints: Map<string, Entities.Endpoint> = new Map();
        // continue with Endpoints
        for (const [key, node] of Object.entries(this.#topologyTemplate.node_templates)) {
            if (node.type === ENDPOINT_TOSCA_KEY) {
                let uuid = uuidv4();
                let endpoint = new Entities.Endpoint(uuid, this.#transformYamlKeyToLabel(key), readToscaMetaData(node.metadata));
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
                this.#keyIdMap.add(key, uuid);
            } else if (node.type === EXTERNAL_ENDPOINT_TOSCA_KEY) {
                let uuid = uuidv4();
                let externalEndpoint = new Entities.ExternalEndpoint(uuid, this.#transformYamlKeyToLabel(key), readToscaMetaData(node.metadata));
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
                this.#keyIdMap.add(key, uuid);
            }
        }

        // continue with components
        for (const [key, node] of Object.entries(this.#topologyTemplate.node_templates)) {
            if (node.type === SERVICE_TOSCA_KEY) {
                let uuid = uuidv4();
                let service = new Entities.Service(uuid, this.#transformYamlKeyToLabel(key), readToscaMetaData(node.metadata));

                this.#parseRequirements(node, service, endpoints);

                if (node.properties) {
                    for (const [key, value] of Object.entries(node.properties)) {
                        service.setPropertyValue(key, value);
                    }
                }

                this.#keyIdMap.add(key, uuid);
                this.#importedSystem.addEntity(service);
            } else if (node.type === BACKING_SERVICE_TOSCA_KEY) {
                let uuid = uuidv4();
                let backingService = new Entities.BackingService(uuid, this.#transformYamlKeyToLabel(key), readToscaMetaData(node.metadata));

                this.#parseRequirements(node, backingService, endpoints);

                if (node.properties) {
                    for (const [key, value] of Object.entries(node.properties)) {
                        backingService.setPropertyValue(key, value);
                    }
                }

                this.#keyIdMap.add(key, uuid);
                this.#importedSystem.addEntity(backingService);
            } else if (node.type === STORAGE_BACKING_SERVICE_TOSCA_KEY) {
                let uuid = uuidv4();
                let storageBackingService = new Entities.StorageBackingService(uuid, this.#transformYamlKeyToLabel(key), readToscaMetaData(node.metadata));

                this.#parseRequirements(node, storageBackingService, endpoints);

                if (node.properties) {
                    for (const [key, value] of Object.entries(node.properties)) {
                        storageBackingService.setPropertyValue(key, value);
                    }
                }

                this.#keyIdMap.add(key, uuid);
                this.#importedSystem.addEntity(storageBackingService);
            } else if (node.type === COMPONENT_TOSCA_KEY) {
                let uuid = uuidv4();
                let component = new Entities.Component(uuid, this.#transformYamlKeyToLabel(key), readToscaMetaData(node.metadata));

                this.#parseRequirements(node, component, endpoints);

                if (node.properties) {
                    for (const [key, value] of Object.entries(node.properties)) {
                        component.setPropertyValue(key, value);
                    }
                }

                this.#keyIdMap.add(key, uuid);
                this.#importedSystem.addEntity(component);
            }
        }

        // parse relationship_templates to add properties to links and deployment mappings
        for (const [key, relationship] of Object.entries(this.#topologyTemplate.relationship_templates)) {

            if (relationship.type === LINK_TOSCA_KEY) {
                if (relationship.properties) {
                    const linkEntity = this.#importedSystem.getLinkEntities.get(this.#keyIdMap.getId(key));
                    for (const [key, value] of Object.entries(relationship.properties)) {
                        linkEntity.setPropertyValue(key, value);
                    }
                }
            } else if (relationship.type === DEPLOYMENT_MAPPING_TOSCA_KEY) {
                if (relationship.properties) {
                    const deploymentMappingEntity = this.#importedSystem.getDeploymentMappingEntities.get(this.#keyIdMap.getId(key));
                    for (const [key, value] of Object.entries(relationship.properties)) {
                        deploymentMappingEntity.setPropertyValue(key, value);
                    }
                }
            }
        }

        // finally add request traces
        for (const [key, node] of Object.entries(this.#topologyTemplate.node_templates)) {
            if (node.type === REQUEST_TRACE_TOSCA_KEY) {
                let uuid = uuidv4();

                let externalEndpoint = node.properties && node.properties["referred_endpoint"] ? endpoints.get(this.#keyIdMap.getId(node.properties["referred_endpoint"])) : null; // TODO something better than null?
                let links = node.properties && node.properties["involved_links"] ? node.properties["involved_links"].map(linkKey => this.#importedSystem.getLinkEntities.get(this.#keyIdMap.getId(linkKey))) : [];

                let requestTrace = new Entities.RequestTrace(uuid, this.#transformYamlKeyToLabel(key), readToscaMetaData(node.metadata), externalEndpoint, links);

                if (node.properties) {
                    for (const [key, value] of Object.entries(node.properties)) {
                        switch (key) {
                            case "involved_links":
                                requestTrace.setPropertyValue(key, value.map(linkKey => this.#keyIdMap.getId(linkKey)));
                                break;
                            case "referred_endpoint":
                                requestTrace.setPropertyValue(key, this.#keyIdMap.getId(value));
                                break;
                            case "nodes":
                                requestTrace.setPropertyValue(key, value.map(nodeKey => this.#keyIdMap.getId(nodeKey)));
                                break;
                            default:
                                requestTrace.setPropertyValue(key, value);
                        }
                    }
                }

                this.#keyIdMap.add(key, uuid);
                this.#importedSystem.addEntity(requestTrace);
            }
        }

        return this.#importedSystem;
    }

    #transformYamlKeyToLabel(key: string) {

        // 1. replace underscore with whitespace
        // 2. make first character uppercase
        // 3. make all characters after a space uppercase

        return key.replace(MATCH_UNDERSCORE, " ").replace(MATCH_FIRST_CHARACTER, (match) => match.toUpperCase()).replace(MATCH_CHARACTER_AFTER_SPACE, (match, p1, p2) => `${p1}${p2.toUpperCase()}`)
    }


    #parseRequirements(node: TOSCA_Node_Template, component: Entities.Component, endpoints: Map<string, Entities.Endpoint>) {
        if (node.requirements) {
            for (const requirementAssignment of node.requirements) {
                for (const [requirementKey, requirement] of Object.entries(requirementAssignment)) {
                    switch (requirementKey) {
                        case "uses_data":
                            if (typeof requirement === "string") {
                                component.addDataEntity(this.#importedSystem.getDataAggregateEntities.get(this.#keyIdMap.getId(requirement)), "");
                            } else if (typeof requirement === "object") {
                                // TODO requirement is of type TOSCA_Requirement_Assignment
                                if (requirement.node && requirement.relationship && typeof requirement.relationship === "string") {
                                    let relationship = this.#topologyTemplate.relationship_templates[requirement.relationship];
                                    let usageRelation: DataUsageRelation = relationship.properties && relationship.properties["usage_relation"] ? relationship.properties["usage_relation"] : "";
                                    component.addDataEntity(this.#importedSystem.getDataAggregateEntities.get(this.#keyIdMap.getId(requirement.node)), usageRelation);
                                }
                            }
                            break;
                        case "uses_backing_data":
                            if (typeof requirement === "string") {
                                component.addDataEntity(this.#importedSystem.getBackingDataEntities.get(this.#keyIdMap.getId(requirement)), "");
                            } else if (typeof requirement === "object") {
                                // TODO requirement is of type TOSCA_Requirement_Assignment
                                if (requirement.node && requirement.relationship && typeof requirement.relationship === "string") {
                                    let relationship = this.#topologyTemplate.relationship_templates[requirement.relationship];
                                    let usageRelation: DataUsageRelation = relationship.properties && relationship.properties["usage_relation"] ? relationship.properties["usage_relation"] : "";
                                    component.addDataEntity(this.#importedSystem.getBackingDataEntities.get(this.#keyIdMap.getId(requirement.node)), usageRelation);
                                }
                            }
                            break;
                        case "provides_endpoint":
                            if (typeof requirement === "string") {
                                // TODO requirement is of type string
                            } else {
                                component.addEndpoint(endpoints.get(this.#keyIdMap.getId(requirement.node)));
                            }
                            break;
                        case "provides_external_endpoint":
                            if (typeof requirement === "string") {
                                // TODO requirement is of type string
                            } else {
                                component.addEndpoint(endpoints.get(this.#keyIdMap.getId(requirement.node)));
                            }
                            break;
                        case "host":
                            if (typeof requirement === "string") {
                                // TODO requirement is of type string
                            } else {
                                let linkId = uuidv4();
                                let deploymentMapping = new Entities.DeploymentMapping(linkId, component, this.#importedSystem.getInfrastructureEntities.get(this.#keyIdMap.getId(requirement.node)));
                                this.#keyIdMap.add(requirement.relationship as string, linkId) // TODO requirement.relationship is object
                                this.#importedSystem.addEntity(deploymentMapping);
                            }
                            break;
                        case "endpoint_link":
                            if (typeof requirement === "string") {
                                // TODO requirement is of type string
                            } else if (typeof requirement === "object") {
                                let linkId = uuidv4();
                                let link = new Entities.Link(linkId, component, endpoints.get(this.#keyIdMap.getId(requirement.node)));
                                this.#keyIdMap.add(requirement.relationship as string, linkId) // TODO requirement.relationship is object
                                this.#importedSystem.addEntity(link);
                                // TODO add to Component (includedLinks?)
                            }
                            break;
                    }
                }
            }
        }
    }
}

export { ToscaToEntitesConverter }