import { Router } from "express";
import { sseStreamHandler } from "../controller/notifications/sse-stream.js";
import { listNotifications } from "../controller/notifications/list-notifications.js";
import { unreadCount } from "../controller/notifications/unread-count.js";
import { readAll } from "../controller/notifications/read-all.js";
import { readOne } from "../controller/notifications/read-one.js";

const notificationsRouter = Router();

notificationsRouter.get("/", listNotifications);
notificationsRouter.get("/unread-count", unreadCount);
notificationsRouter.put("/read-all", readAll);
notificationsRouter.put("/:id/read", readOne);

export { sseStreamHandler };
export default notificationsRouter;
