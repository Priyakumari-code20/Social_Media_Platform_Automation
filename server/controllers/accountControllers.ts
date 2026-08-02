import { Response } from "express";
import { AuthRequest } from "../middlewares/authMiddleware.js";
import { Account } from "../models/Account.js";
import zernio from "../config/zernio.js";

// Get all accounts
// GET/api/accounts

export const getAccounts = async(req: AuthRequest, res: Response) : Promise<void> => {
    try{
        const accounts = await Account.find({ userId: req.user._id });
        res.json(accounts);
    }catch(error: any){
        res.status(500).json({message: error?.message || "Server error"});
    }
}

// add account
// POST/api/accounts

export const addAccount = async(req: AuthRequest, res: Response) : Promise<void> => {
    try{
        const { platform, handle, avatarUrl } = req.body;
        const account = await Account.create({ platform, handle, avatarUrl, userId: req.user._id });
        res.status(201).json(account);
    }catch(error: any){
        res.status(500).json({message: error?.message || "Server error"});
    }
}

// Disconnect account
// DELETE/api/accounts/:id

export const disconnectAccount = async(req: AuthRequest, res: Response) : Promise<void> => {
    try{
        const account = await Account.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if(!account){
            res.status(404).json({message: "Account not found"});
            return;
        }

        if(account.zernioAccountId){
            try{
                await zernio.accounts.deleteAccount({accountId: account.zernioAccountId});

            }catch(error: any){
                res.status(500).json({message: error?.message?.data?.message || "Server error"});
                return

            }
        }
        await account.deleteOne()
        res.json({message: "Account disconnected successfully"});

    }catch(error: any){
        res.status(500).json({message: error?.message || "Server error"});
    }
}




