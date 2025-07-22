import mongoose from "mongoose";

const playerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    team: {
        type: String,
        enum: ['blue', 'red', 'spectator'],
        default: 'spectator'
    },
    role: {
        type: String,
        enum: ['captain', 'player'],
        validate: {
            validator: function(value) {
                if (this.team === 'spectator') {
                    return !value;
                }
                return value && ['captain', 'player'].includes(value);
            },
            message: 'Spectators cannot have roles, and players on blue/red teams must have a role'
        }
    },
    score: {
        type: Number,
        default: 0
    },
    isHost: {
        type: Boolean,
        default: false
    },
    joinedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: true });

const lobbySchema = new mongoose.Schema({
    lobbySettings: {
        code: {
            type: String,
            required: true,
            unique: true,
        },
        rounds: {
            type: Number,
            required: true,
            default: 10,
        },
        timeLimit: {
            type: Number,
            default: 60, // seconds per round
        },
        maxPlayers: {
            type: Number,
            default: 8,
        }
    },
    players: [playerSchema],
    gameState: {
        type: String,
        enum: ['waiting', 'playing', 'finished'],
        default: 'waiting'
    },
    currentRound: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for performance
lobbySchema.index({ 'lobbySettings.code': 1 });
lobbySchema.index({ gameState: 1 });

// Instance Methods
lobbySchema.methods.addPlayer = function(playerData) {
    this.players.push(playerData);
    return this.save();
};

lobbySchema.methods.removePlayer = function(playerName) {
    this.players = this.players.filter(player => player.name !== playerName);
    return this.save();
};

lobbySchema.methods.getPlayerByName = function(name) {
    return this.players.find(player => player.name === name);
};

lobbySchema.methods.getPlayersByTeam = function(team) {
    return this.players.filter(player => player.team === team);
};

lobbySchema.methods.getHost = function() {
    return this.players.find(player => player.isHost);
};

// Static Methods
lobbySchema.statics.findByCode = function(code) {
    return this.findOne({ 'lobbySettings.code': code });
};

lobbySchema.statics.findActiveLobbies = function() {
    return this.find({ gameState: { $in: ['waiting', 'playing'] } });
};

const Lobby = mongoose.model('Lobby', lobbySchema);
export default Lobby;


