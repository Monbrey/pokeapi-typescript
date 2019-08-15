import Collection = require("collection");
import fetch from "node-fetch";
import { URLSearchParams } from "url";
import nonenumerable from "../decorators/enumerable";
import { IApiResourceList } from "../interfaces/Utility/ResourceList";
import { ApiResourceList } from "./ApiResourceList";

export type EndpointParam = number;

const BASE_URI = "https://pokeapi.co/api/v2";

export class Endpoint<T> {
    @nonenumerable
    protected resource: string;
    @nonenumerable
    protected _list: ApiResourceList<T>;
    protected cache: Collection<number, T>;

    constructor(resource) {
        this.resource = resource;
        this.cache = new Collection<number, T>();
    }

    /**
     * Retrieve a resource from the cache
     * @param {EndpointParam} param - The ID of the resource to retrieve from cache
     * @returns {?T}
     */
    public get(param: EndpointParam): T {
        return this.cache.get(param);
    }

    /**
     * Retrieve a resource from cache if it exists, or attempt to fetch it from the API
     * @param {EndpointParam} param - The ID of the resource to resolve
     * @returns {Promise<T>}
     */
    public async resolve(param: EndpointParam): Promise<T> {
        return this.get(param) || this.fetch(param);
    }

    /**
     * Fetch a resource from the API
     * @param {EndpointParam} param - The ID of the item to fetch
     * @param {boolean} [cache=true] - Whether or not to cache this resource
     * @returns {Promise<T>}
     */
    public async fetch(param: EndpointParam, cache: boolean = true): Promise<T> {
        const data = await fetch(`${BASE_URI}/${this.resource}/${param}`).then(res => res.json());
        this._cache(data);
        return data;
    }

    /**
     * Fetches the paginated resource list from the API, or uses the internal cache if listAll() has been called.
     * @param {number} [limit=20] - How many resources to list
     * @param {offset} [offset=0]
     * @returns {Promise<NamedApiResourceList<T>>}
     */
    public async list(limit: number = 20, offset: number = 0): Promise<ApiResourceList<T>> {
        if (this._list) {
            const results = this._list.results.slice(offset, limit);
            const { count, next, previous } = this._list;
            return new ApiResourceList<T>({ count, next, previous, results }, this);
        }

        const params = new URLSearchParams({ limit: `${limit}`, offset: `${offset}` });
        const list = await fetch(`${BASE_URI}/${this.resource}?${params}`).then(res => res.json());
        return new ApiResourceList<T>(list, this);
    }

    /**
     * Fetches the complete resource list from the API by making two calls.
     * Caches the list by default for API-less pagination
     * @param {boolean} [cache=true] - If the result should be cahced in-memory
     * @returns {Promise<NamedApiResourceList<T>>}
     */
    public async listAll(cache: boolean = true): Promise<ApiResourceList<T>> {
        if (this._list) { return this._list; }

        const { count } = await fetch(`${BASE_URI}/${this.resource}?limit=1`).then(res => res.json());
        const data = await fetch(`${BASE_URI}/${this.resource}?limit=${count}`).then(res => res.json());
        const list = new ApiResourceList<T>(data, this);
        if (cache) { this._list = list; }

        return list;
    }

    public _cache(data) {
        this.cache.set(data.id, data);
    }
}
