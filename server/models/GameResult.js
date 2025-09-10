import mongoose from 'mongoose';

const RoundSummarySchema = new mongoose.Schema({
    roundNumber: { type: Number, required: true },
    question: { type: String, required: true },
    tag: { type: String, required: false },
    blueAnswer: { type: String, required: false },
    redAnswer: { type: String, required: false },
    blueSteal: { type: Boolean, default: false },
    redSteal: { type: Boolean, default: false },
    winner: { type: String, enum: ['blue', 'red', 'tie', null], default: null },
    bluePointsGained: { type: Number, default: 0 },
    redPointsGained: { type: Number, default: 0 },
}, { _id: false });

const TeamPlayerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    isCaptain: { type: Boolean, default: false },
}, { _id: false });

const GameResultSchema = new mongoose.Schema({
    lobbyCode: { type: String, index: true, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    settings: {
        rounds: { type: Number, required: true },
        roundLimit: { type: Number, required: true },
        tags: { type: [String], default: [] },
    },
    scores: {
        blue: { type: Number, required: true },
        red: { type: Number, required: true },
    },
    winner: { type: String, enum: ['blue', 'red', 'tie'], required: true },
    blueTeam: { type: [TeamPlayerSchema], default: [] },
    redTeam: { type: [TeamPlayerSchema], default: [] },
    rounds: { type: [RoundSummarySchema], default: [] },
}, { timestamps: true });

export default mongoose.model('GameResult', GameResultSchema);


