import * as express from 'express';

import logger from '../../../../utils/winston';
import { buildBoundaryFilter, filterQueryArgs } from '../../utils';
import { getOpenAPI3Responses, paginationParameters, primaryBoundaryParameters } from '../../../docs';
import { formatCollection } from '../format';
import { AtomicAssetsNamespace } from '../index';
import { HTTPServer } from '../../../server';
import { greylistFilterParameters } from '../openapi';

export function accountsEndpoints(core: AtomicAssetsNamespace, server: HTTPServer, router: express.Router): any {
    router.get('/v1/accounts', server.web.caching({ignoreQueryString: true}), (async (req, res) => {
        try {
            const args = filterQueryArgs(req, {
                page: {type: 'int', min: 1, default: 1},
                limit: {type: 'int', min: 1, max: 1000, default: 100},

                collection_whitelist: {type: 'string', min: 1},
                collection_blacklist: {type: 'string', min: 1},

                match: {type: 'string', min: 1}
            });

            let varCounter = 1;
            let queryString = 'SELECT owner account, COUNT(*) as assets FROM atomicassets_assets asset WHERE contract = $1 AND owner IS NOT NULL ';
            const queryValues: any[] = [core.args.atomicassets_account];

            if (args.match) {
                queryString += 'AND owner ILIKE $' + ++varCounter + ' ';
                queryValues.push('%' + args.match + '%');
            }

            if (args.collection_whitelist) {
                queryString += 'AND asset.collection_name = ANY ($' + ++varCounter + ') ';
                queryValues.push(args.collection_whitelist.split(','));
            }

            if (args.collection_blacklist) {
                queryString += 'AND NOT (asset.collection_name = ANY ($' + ++varCounter + ')) ';
                queryValues.push(args.collection_blacklist.split(','));
            }

            const boundaryFilter = buildBoundaryFilter(
                req, varCounter, 'owner', 'string', null, null
            );
            queryValues.push(...boundaryFilter.values);
            varCounter += boundaryFilter.values.length;
            queryString += boundaryFilter.str;

            queryString += 'GROUP BY owner ORDER BY assets DESC LIMIT $' + ++varCounter + ' OFFSET $' + ++varCounter + ' ';
            queryValues.push(args.limit);
            queryValues.push((args.page - 1) * args.limit);

            logger.debug(queryString);

            const query = await core.connection.database.query(queryString, queryValues);

            return res.json({success: true, data: query.rows});
        } catch (e) {
            logger.error(req.originalUrl + ' ', e);

            return res.status(500).json({success: false, message: 'Internal Server Error'});
        }
    }));

    router.get('/v1/accounts/:account', server.web.caching({ignoreQueryString: true}), (async (req, res) => {
        try {
            const args = filterQueryArgs(req, {
                collection_whitelist: {type: 'string', min: 1},
                collection_blacklist: {type: 'string', min: 1}
            });

            let varCounter = 2;
            let queryString = 'SELECT collection_name, COUNT(*) as assets ' +
                'FROM atomicassets_assets asset ' +
                'WHERE contract = $1 AND owner = $2 ';
            const queryValues: any[] = [core.args.atomicassets_account, req.params.account];

            if (args.collection_whitelist) {
                queryString += 'AND asset.collection_name = ANY ($' + ++varCounter + ') ';
                queryValues.push(args.collection_whitelist.split(','));
            }

            if (args.collection_blacklist) {
                queryString += 'AND NOT (asset.collection_name = ANY ($' + ++varCounter + ')) ';
                queryValues.push(args.collection_blacklist.split(','));
            }

            queryString += 'GROUP BY collection_name ORDER BY assets DESC';

            const query = await core.connection.database.query(queryString, queryValues);

            const collections = await core.connection.database.query(
                'SELECT * FROM atomicassets_collections_master WHERE contract = $1 AND collection_name = ANY ($2)',
                [core.args.atomicassets_account, query.rows.map(row => row.collection_name)]
            );

            const lookupCollections = collections.rows.reduce(
                (prev, current) => Object.assign(prev, {[current.collection_name]: formatCollection(current)}), {}
            );

            return res.json({
                success: true,
                data: {
                    collections: query.rows.map(row => ({
                        collection: lookupCollections[row.collection_name],
                        assets: row.assets
                    })),
                    assets: query.rows.reduce((prev, current) => prev + parseInt(current.assets, 10), 0)
                }
            });
        } catch (e) {
            logger.error(req.originalUrl + ' ', e);

            return res.status(500).json({success: false, message: 'Internal Server Error'});
        }
    }));

    return {
        tag: {
            name: 'stats',
            description: 'Stats'
        },
        paths: {
            '/v1/accounts': {
                get: {
                    tags: ['stats'],
                    summary: 'Get accounts which own atomicassets NFTs',
                    parameters: [
                        {
                            name: 'match',
                            in: 'query',
                            description: 'Search for partial account name',
                            required: false,
                            schema: {type: 'string'}
                        },
                        ...greylistFilterParameters,
                        ...primaryBoundaryParameters,
                        ...paginationParameters
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                account: {type: 'string'},
                                assets: {type: 'integer'}
                            }
                        }
                    })
                }
            },
            '/v1/accounts/{account}': {
                get: {
                    tags: ['stats'],
                    summary: 'Get a specific account',
                    parameters: [
                        {
                            name: 'account',
                            in: 'path',
                            description: 'Account name',
                            required: true,
                            schema: {type: 'string'}
                        },
                        ...greylistFilterParameters
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                collections: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            collection: {'$ref': '#/components/schemas/Collection'},
                                            assets: {type: 'integer'}
                                        }
                                    }
                                },
                                assets: {type: 'integer'}
                            }
                        }
                    })
                }
            }
        }
    };
}
