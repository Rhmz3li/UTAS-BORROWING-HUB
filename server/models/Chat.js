import mongoose from "mongoose";

const ChatMessageSchema = mongoose.Schema({
    role: { type: String, enum: ['user', 'assistant', 'system', 'tool'], required: true },
    content: { type: String, default: '' },
    tool_calls: { type: Array, default: [] },
    tool_call_id: { type: String, default: null }
}, { _id: false });

const ChatSchema = mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
    session_id: { type: String, required: true, index: true },
    messages: [ChatMessageSchema],
    title: { type: String, default: 'New Chat' }
}, {
    timestamps: true
});

ChatSchema.index({ user_id: 1, session_id: 1 });
ChatSchema.index({ user_id: 1, updatedAt: -1 });

const ChatModel = mongoose.model("Chats", ChatSchema, "Chats");
export default ChatModel;
