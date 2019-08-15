import fetch from "node-fetch";
import { URLSearchParams } from "url";
import nonenumerable from "../decorators/enumerable";
import { Endpoint, EndpointParam } from "./Endpoint";
import { NamedApiResourceList } from "./NamedApiResourceList";

export type NamedEndpointParam = EndpointParam | string;

const BASE_URI = "https://pokeapi.co/api/v2";

export class NamedEndpoint<T> extends Endpoint<T> {
    @nonenumerable
    protected _list: NamedApiResourceList<T>;
    @nonenumerable
    private _nameMap: Map<string, number>;

    constructor(resource) {
        super(resource);
        this._nameMap = new Map<string, number>();
    }

    /**
     * Retrieve a resource from the cache by name or ID
     * @param {NamedEndpointParam} param - The name or ID of the resource to retrieve from cache
     * @returns {?T}
     */
    public get(param: NamedEndpointParam): T {
        return this.cache.get(typeof param === "number" ? param : this._nameMap.get(param.toLowerCase()));
    }

    /**
     * Fetch a resource from the API
     * @param {NamedEndpointParam} param - The name orcID of the resource to fetch
     * @param {boolean} [cache=true] - Whether or not to cache this resource
     * @returns {Promise<T>}
     */
    public async fetch(param: NamedEndpointParam, cache: boolean = true): Promise<T> {
        param = typeof param === "string" ? param.toLowerCase() : param;

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
    public async list(limit: number = 20, offset: number = 0): Promise<NamedApiResourceList<T>> {
        if (this._list) {
            const results = this._list.results.slice(offset, limit);
            const { count, next, previous } = this._list;
            return new NamedApiResourceList<T>({ count, next, previous, results }, this);
        }

        const params = new URLSearchParams({ limit: `${limit}`, offset: `${offset}` });
        const list = await fetch(`${BASE_URI}/${this.resource}?${params}`).then(res => res.json());
        return new NamedApiResourceList<T>(list, this);
    }

    /**
     * Fetches the complete resource list from the API by making two calls.
     * Caches the list by default for API-less pagination
     * @param {boolean} [cache=true] - If the result should be cahced in-memory
     * @returns {Promise<NamedApiResourceList<T>>}
     */
    public async listAll(cache: boolean = true): Promise<NamedApiResourceList<T>> {
        if (this._list) { return this._list; }

        const { count } = await fetch(`${BASE_URI}/${this.resource}?limit=1`).then(res => res.json());
        const data = await fetch(`${BASE_URI}/${this.resource}?limit=${count}`).then(res => res.json());
        const list = new NamedApiResourceList<T>(data, this);
        if (cache) { this._list = list; }

        return list;
    }

    public _cache(data) {
        this.cache.set(data.id, data);
        this._nameMap.set(data.name, data.id);
    }
}
