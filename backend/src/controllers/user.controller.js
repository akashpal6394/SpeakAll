import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";

export async function getRecommendedUsers(req, res) {

    try{
        const currentUserId = req.user.id;
        const currentUser = req.user

        const recommendedUsers = await User.find({
            $and:[
                {_id: {$ne: currentUserId}},
                {$id: {$nin: currentUser.friends}},
                {isOnboarded: true}
            ]
        })
        res.status(200).json(recommendedUsers);
    }catch(error){
        console.error("Error fetching recommended users:", error.message);
        res.status(500).json({message: "Internal server error"});
    }
}

export async function getMyFriends(req, res) {
    try {
        const user = await User.findById(req.user.id)
        .select("friends")
        .populate("friends", "fullName profilePic nativeLanguage learningLanguage");

        res.status(200).json(user.friends);
    } catch (error) {
        console.error("Error fetching friends:", error.message);
        res.status(500).json({message: "Internal server error"});
    }
}

export async function sendFriendRequest(req, res) {
    try {
        const myId = req.user.id;
        const {id:recipientId} =req.params;
        //prevent sending friend request to self
        if(myId === recipientId) {
            return res.status(400).json({message: "You cannot send a friend request to yourself."});
        }
        const recipient = await User.findById(recipientId);
        if(!recipient) {
            return res.status(404).json({message: "Recipient not found."});
        }
        //check if recipient is already a friend
        if(recipient.friends.includes(myId)) {
            return res.status(400).json({message: "You are already friends with this user."});
        } 
        //check if request already exists
        const existingRequest = await FriendRequest.findOne({
            $or: [
                {sender: myId, recipient: recipientId},
                {sender: recipientId, recipient: myId}
            ]
        });
        if(existingRequest) {
            return res.
            status(400)
            .json({message: "Friend request already exists."});
        }
        const FriendRequest = await FriendRequest.create({
            sender: myId,
            recipient: recipientId,
        });
        res.status(201).json(FriendRequest);

    } catch (error) {
        console.error("Error sending friend request:", error.message);
        res.status(500).json({message: "Internal server error"});
    }
}

export async function acceptFriendRequest(req, res) {
    try {
        const {id: requestId} = req.params;

        const friendRequest = await FriendRequest.findById(requestId);

        if(!friendRequest) {
            return res.status(404).json({message: "No friend requests found."});
        }
        //verify if current user is the recipient
        if(friendRequest.recipient.toString() !== req.user.id) {
            return res.status(403).json({message: "You are not authorized to accept this request."});
        }

        friendRequest.status = "accepted";
        await friendRequest.save();

        //add each user to otenr user's friends list
        //$addToSet: adds elements to an array only if they don't already exist
        await User.findByIdAndUpdate(friendRequest.sender,{
            $addToSet: { friends: friendRequest.recipient },
        });

        await User.findByIdAndUpdate(friendRequest.recipient, {
            $addToSet: { friends: friendRequest.sender },
        });

        res.status(200).json({message: "Friend request accepted successfully."});
    } catch (error) {
        console.error("Error accepting friend request:", error.message);
        res.status(500).json({message: "Internal server error"});   
    }
}

export async function getFriendRequests(req,res){
    try {
        const incomingReqs = await FriendRequest.find({
            recipient: req.user.id,
            status: "pending",
        }).populate("sender", "fullName profilePic nativeLanguage learningLanguage");

        const acceptedReqs = await FriendRequest.find({
            sender: req.user.id,
            status: "accepted",
        }).populate("recipient", "fullName profilePic");

        res.status(200).json({incomingReqs, acceptedReqs});
    } catch (error) {
        console.log("Error in getpendingFriendRequests friend requests:", error.message);
        res.status(500).json({message: "Internal server error"});
    }
}

export async function getOutgoingFriendReqs(req, res) {
  try {
    const outgoingRequests = await FriendRequest.find({
      sender: req.user.id,
      status: "pending",
    }).populate("recipient", "fullName profilePic nativeLanguage learningLanguage");

    res.status(200).json(outgoingRequests);
  } catch (error) {
    console.log("Error in getOutgoingFriendReqs controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}