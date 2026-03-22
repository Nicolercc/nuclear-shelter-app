import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nuclearRouter from "./nuclear";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nuclearRouter);

export default router;
