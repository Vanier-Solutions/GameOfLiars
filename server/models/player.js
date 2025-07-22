import mongoose from "mongoose";

const playerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is requred'],
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
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true // Automatically manage createdAt and updatedAt
});

// index by name for performance
playerSchema.index({ name: 1 });


// Instance Methods
playerSchema.methods.getFullInfo = function() {
    return `${this.name} is on ${this.team}, they are a ${this.role}`;
}

// Static Methods
playerSchema.statics.findAllByTeam = function(tm) {
    return this.find({ team: tm});
}


const Player = mongoose.model('Player', playerSchema);
export default Player;


