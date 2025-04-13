import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  projectid: {
    type: String,
    required: [true, "Projectid is required"],
  },
  name: {
    type: String,
    required: [true, "Name is required"],
  },
  email: {
    type: String,
    required: [true, "Email is required"],
  },
  mobile: {
    type: String,
    required: [true, "Phone Number is required"],
  },
  position: {  
    type: String,
    required: [true, "Position is required"],
  },
  password: {
    type: String,
    required: [true, "Password is required"],
  },
  isProjectAdmin: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
});

const User = mongoose.model("User", userSchema);
export default User;