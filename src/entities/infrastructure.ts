import { BackingData } from "./backingData";
import { EntityProperty } from "./entityProperty";

/**
 * The module for aspects related to an Infrastructure quality model entity.
 * @module entities/infrastructure
 */

const InfrastructureTypes = Object.freeze({
    COMPUTE: "compute",
    DBMS: "dbms"
});

type infrastructureType = "compute" | "dbms"

function getInfrastructureProperties() {
    return []
}

/**
 * Class representing an Infrastructure entity.
 * @class
 */
class Infrastructure {

    #id: string; // TODO

    #modelId: string;

    #infrastructureType: infrastructureType;

    name: string;

    #hostedBy: Infrastructure;

    #backingDataEntities: BackingData[] = new Array();

    #properties: EntityProperty[];

    /**
     * Create an Infrastructure entity.
     * @param {string} name The name of the Infrastructure entity. 
     * @param {modelId} modelId The ID, the respective entity representation has in the joint.dia.Graph model.
     */
    constructor(name: string, modelId: string, infrastructureType: infrastructureType) {
        this.name = name;
        this.#modelId = modelId;
        this.#infrastructureType = infrastructureType;
        this.#properties = getInfrastructureProperties();
    }

    /**
     * Add a {@link BackingData} entity to the Component. In case the provided entity is not a Backing Data entity, a {@link TypeError} exception will be thrown.
     * @param {BackingData} backingDataEntity The Backing Data entity that should be added.
     * @throws {TypeError} If the provided parameter is neither an instance of External Endpoint, Endpoint, Data Aggregate or Backing Data.  
     */
    addBackingDataEntity(backingDataEntity: BackingData) {
        this.#backingDataEntities.push(backingDataEntity);

        /*
        const errorMessage = "The provided entity cannot be added. Only BackingData entities are allowed. However, the object to add was: " + Object.getPrototypeOf(backingDataEntity) + JSON.stringify(backingDataEntity);
        throw new TypeError(errorMessage);
        */
    }

    /**
     * Add the name of the hosting {@link Infrastructure} entity for this {@link Infrastructure} entity.
     * @param {Infrastructure} infrastructureName The name of the hosting {@link Infrastructure} entity.
     */
    addHostingEntity(infrastructure: Infrastructure) {
        this.#hostedBy = infrastructure;
    }

    /**
     * Returns the ID of this Infrastructure entity.
     * @returns {string}
     */
    get getId() {
        return this.#id;
    }

    /**
     * Returns the ID, the respective entity representation has in the joint.dia.Graph model.
     * @returns {string}
     */
    get getModelId() {
        return this.#modelId;
    }

    /**
     * Returns the type of Infrastructure, meaning if Storage Backing Service entities are deployed its a DBMS Tosca Node e.g.
     * returns {InfrastructureType}
     */
    get getInfrastructureType() {
        return this.#infrastructureType;
    }

    /**
     * Return the name of this Infrastructure entity.
     * @returns {string}
     */
    get getName() {
        return this.name;
    }

    /**
     * Returns the {@link BackingData} entities included in this Infrastructure entity.
     * @returns {BackingData[]}
     */
    get getBackingDataEntities() {
        return this.#backingDataEntities;
    }

    /**
     * Return the name of the {@link Infrastructure} entity that hosts this Infrastructure entity.
     * @returns {String}
     */
    get getHostedBy() {
        return this.#hostedBy;
    }

    /**
     * Returns all properties of this entity
     * @returns {EntityProperty[]}
     */
    getProperties() {
        return this.#properties;
    }

    /**
     * Transforms the Infrastructure object into a String. 
     * @returns {string}
     */
    toString() {
        return "Infrastructure " + JSON.stringify(this);
    }

    toJson() {
        return JSON.stringify(this.getModelId);
    }
}

export { Infrastructure, InfrastructureTypes, getInfrastructureProperties };