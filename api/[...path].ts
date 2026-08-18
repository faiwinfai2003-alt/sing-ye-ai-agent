import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import { createServer } from "node:http";
import { registerRoutes } from "../server/routes";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: false }));

const ready = registerRoutes(httpServer, app).then(() => {
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    return res.status(err.status || err.statusCode || 500).json({
      message: err.message || "Internal Server Error",
    });
  });
});

export default async function handler(req: Request, res: Response) {
  await ready;
  return app(req, res);
}
