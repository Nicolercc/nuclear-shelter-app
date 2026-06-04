import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nuclearRouter from "./nuclear";
import briefRouter from "./brief";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nuclearRouter);
router.use(briefRouter);

export default router;
