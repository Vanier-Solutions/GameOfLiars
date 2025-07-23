import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
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
  tags: {
    type: [String],
    default: ['general']
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard']
  }
}, {
  timestamps: true
});

export default mongoose.model('Question', questionSchema); 