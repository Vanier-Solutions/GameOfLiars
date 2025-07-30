import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  id: {
    type: Number,
    unique: true,
    sparse: true
  },
  question: {
    type: String,
    required: true,
    trim: true
  },
  correctAnswer: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    default: 'general'
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  usedInLobbies: {
    type: [String],
    default: []
  }
}, {
  timestamps: true,
  collection: 'qs'  // Explicitly specify collection name
});

export default mongoose.model('Question', questionSchema);
