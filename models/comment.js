const mongoose = require("mongoose"),
  Schema = mongoose.Schema;


// Setup a Campground schema
const commentSchema = new Schema({
  text: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  author: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String
  }
});

module.exports = mongoose.model('Comment', commentSchema);