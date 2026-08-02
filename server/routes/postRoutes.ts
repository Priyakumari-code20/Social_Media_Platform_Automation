import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { generatePost, getGenerations, getPosts, schedulePost } from "../controllers/postController.js";
import { upload } from "../config/multer.js";

const postRouter = express.Router();

postRouter.get('/',protect,getPosts);
postRouter.get('/generations',protect,getGenerations);
postRouter.get('/',protect, upload.single("media"), schedulePost);
postRouter.get('/generate',protect, generatePost);

export default postRouter;


