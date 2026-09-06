import { Response } from "express";
import { AuthRequest } from "../middlewares/authMiddleware.js";
import { GoogleGenAI } from "@google/genai";
import { cloudinary } from "../config/cloudinary.js";
import { Generation } from "../models/Generation.js";
import { Post } from "../models/Post.js";
import axios from "axios";


// Generate Post
// POST /api/posts/generate
export const generatePost = async (req:AuthRequest, res: Response): Promise<void> => {
    try {
        const { prompt, tone, generateImage }= req.body;

        const apiKey = process.env.GEMINI_API_KEY;
        if(!apiKey){
            res.status(400).json({message: "Gemini API Key is missing. Please add it to your server/.env file."});
            return;
        }
        const ai = new GoogleGenAI({apiKey});

        // Generate text
        const textResponse = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: `Generate a social media post based on this prompt: "${prompt}"
            Tone: ${tone}.
            Include relevant hashtags.
            Format the response as JSON with "content" and "imagePrompt" feilds.
            The "imagePrompt" should be a highly descriptive promp for an image generator
            that complements the post. `,
        });

        let content = "";
        let imagePrompt = prompt;

        try {
            const rawText = textResponse.text || "";
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            const data = jsonMatch ? JSON.parse(jsonMatch[0]): {content: rawText,imagePrompt: prompt };
            content = data.content;
            imagePrompt = data.imagePrompt;
        } catch (e) {
            content = textResponse.text || ""
        }

        let mediaUrl = "";
        if (generateImage) {
            try {
                const encodedPrompt = encodeURIComponent(imagePrompt);
                const tempUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&referrer=myapp.local`;

                // Fetch the image bytes ourselves
                const imageBuffer = await axios.get(tempUrl, {
                    responseType: "arraybuffer",
                });

                const base64Image = Buffer.from(imageBuffer.data, "binary").toString("base64");
                const dataUri = `data:image/png;base64,${base64Image}`;

                const uploadResult = await cloudinary.uploader.upload(dataUri, {
                    folder: "ai-generations",
                });
                mediaUrl = uploadResult.secure_url;
            } catch (err: any) {
                console.error("Image generation failed:", err?.response?.data || err.message);
            }
        }
    
        // Save generation to DB

        const generation = await Generation.create({
            userId: req.user._id,
            prompt,
            content,
            mediaUrl,
            mediaType: mediaUrl ? "image" : undefined,
            tone
        })
        res.json(generation)

    } catch (error: any) {
        res.status(500).json({
            message: error?.message || "Server error"
        });
        
    }


}

// Get generations
// GET /api/posts/generations
export const getGenerations = async (req:AuthRequest, res: Response): Promise<void> => {
    try {
            const generations = await Generation.find({userId: req.user._id}).sort({createdAt: -1})
        res.json(generations)
    } catch (error: any){
        res.status(500).json({
            message: error?.message || "Server error"
            
        });
        
    }
}

// Get posts
// POST /api/posts
export const getPosts = async (req:AuthRequest, res: Response): Promise<void> => {
    try {
        const posts = await Post.find({userId: req.user._id})
        res.json(posts)
    } catch (error: any) {
        res.status(500).json({ 
            message: error?.message || "Server error"
        });
    }
    
}

// Schedule Post
// POST /api/posts
export const schedulePost = async (req:AuthRequest, res: Response): Promise<void> => {
    try {
        const { content, platforms, scheduledFor, status} = req.body;

        //Parse platforms if it comes as a stringified array from FormData
        let parsedPlatforms = platforms;
        if(typeof platforms === "string"){
            try {
                parsedPlatforms = JSON.parse(platforms)
            } catch (e) {
                parsedPlatforms = platforms.split(",");
            }
        }

        let mediaUrl: string | undefined = req.body.mediaUrl;
        let mediaType: "image" | "video" | undefined =  req.body.mediaType;

        if(req.file){
            const result = await new Promise<any>((resolve, reject)=>{
                const stream = cloudinary.uploader.upload_stream({resource_type: "auto",
                    folder: "social-scheduler"}, (error,result)=> {
                        if(error) reject(error);
                        else resolve(result)

                    
                });
                stream.end(req.file!.buffer);
            });
            mediaUrl = result.secure_url;
            mediaType = result.resource_type === "video"? "video" : "image";
        }

        //  Save Posts to DB

        const post = await Post.create({
            userId: req.user._id,
            content,
            platforms: parsedPlatforms,
            mediaUrl,
            mediaType,
            scheduledFor,
            status,
        })
        res.status(201).json(post)
        
    } catch (error: any) {
         res.status(500).json({ 
            message: error?.message || "Server error"
        });
    }
}

