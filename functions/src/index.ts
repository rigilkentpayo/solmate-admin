import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";

// Optional. set defaults for all functions.
setGlobalOptions({ region: "us-central1" });

export const ping = onRequest((req, res) => {
    logger.info("Ping called", { method: req.method, query: req.query });
    res.status(200).send("ok");
});
