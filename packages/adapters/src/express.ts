import type { Express, Request, Response, NextFunction } from 'express';

import type { AccountBridge } from '@account-bridge/core';
import {
  createAccountBridgeGatewayHandlers,
  type AccountBridgeGatewayOptions,
  type GatewayRequest,
} from '@account-bridge/gateway';

export interface MountGatewayOptions extends AccountBridgeGatewayOptions {
  /** Mount path prefix for gateway routes (default `/`) */
  mountPath?: string;
}

export function mountAccountBridgeGateway(app: Express, options: MountGatewayOptions): void {
  const { handle } = createAccountBridgeGatewayHandlers(options);

  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const gatewayReq = req as GatewayRequest;
    gatewayReq.body = req.body;
    const handled = await handle(gatewayReq, res);
    if (!handled) next();
  });
}

export type { AccountBridge, AccountBridgeGatewayOptions };
