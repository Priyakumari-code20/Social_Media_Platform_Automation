import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from "mongoose";

const connectDB = async() =>{
    try{
        mongoose.connection.on("connected", async()=>{
            console.log('MongoDB connected');

        });
        await mongoose.connect(process.env.MONGODB_URI!);
    }catch(error: any){
        console.error(error);
        process.exit(1);

    }
}

export default connectDB;