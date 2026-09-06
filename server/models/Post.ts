import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    mediaUrl: { type: String, required: false },
    mediaType: { type: String, enum: ["image", "video"] },
    platforms: [{ type: String, enum: ["twitter", "linkedin", "facebook", "instagram", "facebook_page", "linkedin_page", "instagram_business"] }],
    scheduledFor: { type: String, required: true },
    status:  { type: String, enum: ["draft", "scheduled", "published", "failed"], default: "scheduled" },
}, { timestamps: true });

export const Post = mongoose.model("Post", postSchema);
