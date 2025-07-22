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
            default: 7,
        },
        timeLimit: {
            type: Number,
            required: true,
            default: 60, // seconds per round
        }
    },
    host: {
        type: playerSchema,
        required: true,
    },
    players: {
        spectators: [playerSchema],
        redTeam: [playerSchema],
        blueTeam: [playerSchema],
        blueCaptain: {
            type: playerSchema,
        },
        redCaptain: {
            type: playerSchema,
        },
    },
    gameState: {
        inGame: {
            type: Boolean,
            default: false,
        },
        blueScore: {
            type: Number,
            default: 0,
            required: true,
        },
        redScore: {
            type: Number,
            default: 0,
            required: true,
        },
        currentRound: {
            type: Number,
            default: 0
        },
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

lobbySchema.methods.getPlayersByTeam = function(team) {
    switch (team) {
        case 'blue':
            return this.players.blueTeam;
        case 'red':
            return this.players.redTeam;
        case 'spectator':
            return this.player.spectators;
        default:
            return [];
    }
};



lobbySchema.methods.checkIfPlayerIsHost = function(id) {
    return this.host && this.host.id === id;
}

// Getters and Setters for Captains
lobbySchema.methods.getBlueCaptain = function() {
    return this.blueCaptain;
};

lobbySchema.methods.getRedCaptain = function() {
    return this.redCaptain;
};

lobbySchema.methods.setBlueCaptain = function(playerData) {
    // Validate the player is on blue team
    if (playerData.team !== 'blue') {
        throw new Error('Blue captain must be on blue team');
    }
    this.blueCaptain = playerData;
    return this.save();
};

lobbySchema.methods.setRedCaptain = function(playerData) {
    // Validate the player is on red team
    if (playerData.team !== 'red') {
        throw new Error('Red captain must be on red team');
    }
    this.redCaptain = playerData;
    return this.save();
};

lobbySchema.methods.removeBlueCaptain = function() {
    this.blueCaptain = undefined;
    return this.save();
};

lobbySchema.methods.removeRedCaptain = function() {
    this.redCaptain = undefined;
    return this.save();
};

// Getter and Setter for inGame
lobbySchema.methods.getInGame = function() {
    return this.inGame;
};

lobbySchema.methods.setInGame = function(value) {
    if (typeof value !== 'boolean') {
        throw new Error('inGame must be a boolean value');
    }
    this.inGame = value;
    return this.save();
};

lobbySchema.methods.startGame = function() {
    this.inGame = true;
    return this.save();
};

lobbySchema.methods.endGame = function() {
    this.inGame = false;
    return this.save();
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


