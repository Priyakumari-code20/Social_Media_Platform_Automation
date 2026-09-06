import{Request, Response} from "express";
import zernio from "../config/zernio.js";
import {User} from "../models/User.js";
import {Account} from "../models/Account.js";
import { AuthRequest } from "../middlewares/authMiddleware.js";


const getOrCreateZernioProfile = async (user: any): Promise<string> => {
    try {

        if (!user) {
            throw new Error("User not authenticated");
        }

        // 1. Agar MongoDB mein profile ID already saved hai
        if (user.zernioProfileId) {
            return user.zernioProfileId;
        }

        // 2. Zernio ke existing profiles check karo
        const result = await zernio.profiles.listProfiles();

        console.log("listProfiles response:", result.data);

        const data = result.data as any;

        // 3. Profiles ko response se nikalo
        const profiles: any[] =
            Array.isArray(data)
                ? data
                : data?.profiles ||
                  data?.Profiles ||
                  data?.data ||
                  [];

        console.log("Existing Zernio profiles:", profiles);

        // 4. Agar existing profile mil gayi
        if (profiles.length > 0) {
            const profile = profiles[0];

            const pid = profile._id || profile.id;

            if (!pid) {
                throw new Error(
                    "Existing Zernio profile found but no profile ID returned"
                );
            }

            // Existing profile ID MongoDB mein save karo
            await User.findByIdAndUpdate(
                user._id,
                {
                    zernioProfileId: pid
                }
            );

            console.log("Using existing Zernio profile:", pid);

            return pid;
        }

        // 5. Profile nahi hai to new profile create karo
        const createResult = await zernio.profiles.createProfile({
            body: {
                name: `${user.name || user.email}'s workspace`
            } as any,
        });

        console.log("Created profile response:", createResult.data);

        const created =
            (createResult.data as any)?.profile ||
            createResult.data;

        const pid = created?._id || created?.id;

        if (!pid) {
            throw new Error(
                "Failed to create Zernio profile - no ID returned"
            );
        }

        // New profile ID MongoDB mein save karo
        await User.findByIdAndUpdate(
            user._id,
            {
                zernioProfileId: pid
            }
        );

        console.log("Created new Zernio profile:", pid);

        return pid;

    } catch (error: any) {
        console.error(
            "getOrCreateZernioProfile Error:",
            error?.response?.data ||
            error?.message ||
            error
        );

        throw error;
    }
};

/*
const getOrCreateZernioProfile = async (user:any) : Promise<string> => {
    try{

        const result = await zernio.profiles.listProfiles()
        const data = result.data as any;
        const profiles: any[] = Array.isArray(data)? data : data?.Profiles || data?.data || [];

        if(profiles.length > 0){
            const pid = profiles[0]._id || profiles[0].id;
            await User.findByIdAndUpdate(user._id, {zernioProfileId: pid});
            return pid;
        }

        const createResult = await zernio.profiles.createProfile({
            body: {name: `${user.name || user.email}'s workspace`} as any,
        });

        const created = (createResult.data as any)?.profile || createResult.data;
        const pid = created?._id || created?.id;

        if(!pid){
            throw new Error("Failed to create Zernio profile - no ID returned")
        }

        await User.findByIdAndUpdate(user._id, {zernioProfileId: pid});
        return pid;
    } catch(error: any){
        console.error("getOrCreateZernioProfile Error:", error?.message || error);
        throw error;

    }
}*/

// Generate OAuth authorization URL
// GET /api/auth/:platform

export const generateAuthUrl = async(req: AuthRequest, res: Response) : 
Promise<void> => {
    try{
        console.log("GENERATE URL - req.user:", req.user);

        if (!req.user) {
            res.status(401).json({
                message: "User missing in generateAuthUrl"
            });
            return;
        }

        const{platform} = req.params;
        const profileId = await getOrCreateZernioProfile(req.user);

        const origin = req.headers.origin;
        const redirectUrl =`${origin}/accounts?sync=true&connected=${platform}`;

        const result = await zernio.connect.getConnectUrl({
            path: {platform: platform as any},
            query: {
                profileId,
                redirect_url: redirectUrl
            }
        })

        const data = result.data as any;
        console.log("getConnectUrl response:", JSON.stringify(data,null,2))

        const authUrl = data.authUrl;
        if(!authUrl){
            throw new Error('Zernio returned no authUrl. Full response: ${JSON.stringify(data, null, 2)}')
        }

        res.json({url: authUrl});

    }catch(error: any){
        res.status(500).json ({
            message: error?.message || "Server error"
        })

    }

}

//Sync connected accounts from Zernio into MongoDB
//GET /api/auth/sync-accounts

export const syncAccounts = async(req: AuthRequest, res: Response) : 
Promise<void> => {
    try{
        const profileId = await getOrCreateZernioProfile(req.user);
        const result = await zernio.accounts.listAccounts({
            query: {profileId} as any
        })
        const data = result.data as any;
        const ZernioAccounts: any[] = data?.accounts || data?.Accounts ||(Array.isArray(data) ? data : []);
        const supportedPlatforms = ["twitter", "linkedin", "facebook", "instagram"];
        const syncedAccounts = [];

        for(const zAccount of ZernioAccounts){
            const zid  = zAccount._id  || zAccount.id;          
            if(!zid){
                console.warn("Skipping account with no ID:", zAccount);
                continue;
            }

            const rawPlatform = (zAccount.platform || zAccount.type || "").toLowerCase();
            const normalizedPlatform = supportedPlatforms.find((p) => rawPlatform.includes(p));

            if(!normalizedPlatform){
                console.log(`Skipping unsupported platform: "${rawPlatform}"`);
                continue;
            }

            const account = await Account.findOneAndUpdate(
                {zernioAccountId: zid},
                {
                    userId: req.user._id,
                    platform: normalizedPlatform,
                    handle: zAccount.handle || zAccount.username || zAccount.name || "Unknown",
                    zernioAccountId: zid,
                    status: "connected",
                    avatarUrl: zAccount.avatarUrl || zAccount.picture || zAccount.profile_image_url, 
                },
                {upsert: true, returnDocument: 'after'}
            )
            syncedAccounts.push(account)

        }
        res.json({syncedAccounts});
    }catch(error: any){
        res.status(500).json({
            message: error?.message || "Server error"
        });

    }

}
