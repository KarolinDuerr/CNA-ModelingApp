import { cna_modeling_tosca_profile } from '../../totypa/parsedProfiles/cna_modeling_tosca_profile'
import { MetaData } from '../common/entityDataTypes';


/**
 * The module for aspects related to a Data Aggregate quality model entity.
 * @module entities/dataAggregate
 */

const DATA_AGGREGATE_TOSCA_EQUIVALENT = cna_modeling_tosca_profile.node_types["cna.qualityModel.entities.DataAggregate"];

/**
 * Class representing a Data Aggregate entity.
 * @class
 */
class DataAggregate {

    #id: string;

    name: string;

    #metaData: MetaData;

    #persistedBy: string[];

    // TODO ref components here?

    /**
     * Create a Data Aggregate entity.
     * @param {string} id The unique id for this entity.
     * @param {string} name The name of the Data Aggregate entity. 
     * @param {MetaData} metaData The meta data for this entity, needed for displaying it in a diagram. 
     */
    constructor(id: string, name: string, metaData: MetaData) {
        this.#id = id;
        this.name = name;
        this.#metaData = metaData;
        this.#persistedBy = new Array();
    }

    /**
     * Add name of a component type entity that persists this Data Aggregate entity.
     * @param {string} persistedByEntity The name of a {@link Component} entity that persists this Data Aggregate.
     */
    addPersistedByEntity(persistedByEntity) {
        this.#persistedBy.push(persistedByEntity);
    }

    /**
    * Returns the ID of this Component entity.
    * @returns {string}
    */
    get getId() {
        return this.#id;
    }

    /**
     * Return the name of this Data Aggregate entity.
     * @returns {string}
     */
    get getName() {
        return this.name;
    }

    /**
     * Return the meta data for this node entity.
     * @returns {MetaData}
     */
    get getMetaData() {
        return this.#metaData;
    }

    /**
     * Returns the Entity names that persist this Data Aggregate entity.
     * @returns {string}
     */
    get getPersistedBy() {
        return this.#persistedBy;
    }

    /**
     * Transforms the DataAggregate object into a String. 
     * @returns {string}
     */
    toString() {
        return "DataAggregate " + JSON.stringify(this);
    }
}

export { DataAggregate, DATA_AGGREGATE_TOSCA_EQUIVALENT };