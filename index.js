import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import fileUpload from "express-fileupload";
import dotenv from "dotenv";
import User from "./models/userModel.js";
import ProjectDetails from "./models/ProjectDetails.js";
import { sendEmail } from "./services/emailService.js";
import fs from "fs/promises";
import path from "path";
import { fromArrayBuffer } from "geotiff";
import { fileURLToPath } from "url";
import fs_tiff from "fs";
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 9002;
const app = express();
import { createCanvas } from "canvas";

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(fileUpload());
app.use("/media", express.static(path.join(__dirname, "media")));

//! Connect MongoDB
mongoose.connect(
  process.env.MONGO_URL,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
  () => {
    console.log("✅ Database connected successfully");
  }
);

//! Login Route
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // **Check if the user exists**
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(404).json({ message: "User not registered" });
    }

    // **Password comparison**
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const userDetails = {
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
    };

    res.status(200).json({ message: "Login Successful", user: userDetails });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "An error occurred during login", error });
  }
});

//! Register Route
app.post("/register", async (req, res) => {
  const {
    users,
    project_name,
    department_name,
    address,
    purpose_of_dam,
    dam_height,
    reservoir_area,
    reservoir_volume,
    hfl,
    mrl,
    hydropower_capacity,
    project_description,
    latitude,
    longitude,
    password,
  } = req.body;

  try {
    const existingProject = await ProjectDetails.findOne({ project_name });
    if (existingProject) {
      return res
        .status(400)
        .json({ message: "Project with the same name already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const projectData = new ProjectDetails({
      users: users.map((user) => ({
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        position: user.position, // Added position
        isProjectAdmin: user.isProjectAdmin,
      })),
      project_name,
      department_name,
      address,
      purpose_of_dam,
      dam_height,
      hfl,
      mrl,
      reservoir_area,
      reservoir_volume,
      hydropower_capacity,
      project_description,
      latitude,
      longitude,
      registration_time: new Date(),
      thumbnail_image: "",
      dam_images: [],
      dam_videos: [],
      flood_maps: [],
      reports_file: [],
      GeoJSON_file: [],
      password: hashedPassword,
      Reports: [],
      water_levels: [],
      discharge_levels: [],
    });

    await projectData.save();
    const projectid = projectData._id.toString();
    const mediaPath = path.join(__dirname, "media", projectid);

    try {
      await fs.mkdir(mediaPath, { recursive: true });
    } catch (error) {
      console.error(`Failed to create directory: ${mediaPath}`, error);
    }

    for (const user of users) {
      const { name, email, mobile, position, isProjectAdmin } = user; // Added position
      const newUser = new User({
        projectid,
        name,
        email,
        mobile,
        position, // Added position
        password: hashedPassword,
        isProjectAdmin: isProjectAdmin,
      });

      await newUser.save();

      const emailContent = `
        <h1>New Registration for Project: ${project_name}</h1>
        <p>You have been successfully registered.</p>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Position:</strong> ${
          position || "Not specified"
        }</p> <!-- Added position -->
        <p><strong>Password:</strong> ${password}</p>
      `;
      const emailResponse = await sendEmail(
        email,
        `Project Registration Confirmation`,
        emailContent
      );

      if (!emailResponse.success) {
        console.error("Error sending email:", emailResponse.message);
      }
    }
    res
      .status(200)
      .json({ message: "Successfully Registered, Please login now." });
  } catch (error) {
    res.status(400).json({
      message: "An error occurred during registration",
      error,
      status: 400,
    });
  }
});

//! Get all projects for admin
app.get("/all-projects", async (req, res) => {
  try {
    const projects = await ProjectDetails.find();
    res.status(201).json({ projects: projects });
  } catch (error) {
    res.status(400).json({
      message: "An error occurred during project creation",
      error,
      status: 400,
    });
  }
});

//! Get Project details For update project and User
app.get("/project-details/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const project = await ProjectDetails.findOne({
      _id: mongoose.Types.ObjectId(projectId),
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json({ project: project });
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while fetching project details",
      error,
    });
  }
});

//! Update Project details
app.post("/update-project-details", async (req, res) => {
  try {
    const { project_id, ...projectDetails } = req.body;

    if (!mongoose.Types.ObjectId.isValid(project_id)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    if (Object.keys(projectDetails).length === 0) {
      return res
        .status(400)
        .json({ message: "No project details provided for update" });
    }

    const updatedProject = await ProjectDetails.findByIdAndUpdate(
      project_id,
      projectDetails,
      { new: true, runValidators: true }
    );

    if (!updatedProject) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json({
      message: "Project details updated successfully",
      updatedProject,
    });
  } catch (error) {
    console.error("Error updating project details:", error);

    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return res
        .status(400)
        .json({ message: "Validation error", errors: validationErrors });
    }

    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

//! Add More Users
app.post("/add-users", async (req, res) => {
  const { users, project_id } = req.body;

  try {
    // Validate project_id
    if (!mongoose.Types.ObjectId.isValid(project_id)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    // Find the project by project_id
    const project = await ProjectDetails.findOne({
      _id: mongoose.Types.ObjectId(project_id),
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Validate all required fields for each user
    const requiredFields = ["name", "email", "mobile", "position"];
    for (const user of users) {
      for (const field of requiredFields) {
        if (!user[field]) {
          return res
            .status(400)
            .json({ message: `Missing required field: ${field}` });
        }
      }
    }

    // Get existing users in THIS project only
    const existingProjectUsers = project.users || [];
    const existingEmails = new Set(existingProjectUsers.map((u) => u.email));

    const newUsers = users.filter(
      (newUser) => !existingEmails.has(newUser.email)
    );

    if (newUsers.length === 0) {
      return res
        .status(400)
        .json({ message: "All provided users already exist in this project" });
    }

    // Prepare users with all fields including position and isProjectAdmin
    const usersToAdd = newUsers.map((user) => ({
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      position: user.position,
      isProjectAdmin: user.isProjectAdmin || false,
    }));

    // Update the ProjectDetails with new users
    const result = await ProjectDetails.findOneAndUpdate(
      { _id: mongoose.Types.ObjectId(project_id) },
      { $push: { users: { $each: usersToAdd } } },
      { new: true }
    );

    // Add new users to the User collection using project's hashed password
    for (const user of newUsers) {
      const { name, email, mobile, position, isProjectAdmin } = user;

      // Use the project's existing hashed password
      const projectHashedPassword = project.password;

      const newUser = new User({
        projectid: project_id.toString(),
        name,
        email,
        mobile,
        position,
        isProjectAdmin: isProjectAdmin || false,
        password: projectHashedPassword, // Use project's hashed password
      });

      await newUser.save();

      // Send registration confirmation email without revealing the password
      const emailContent = `
        <h1>Welcome to Project: ${project.project_name}</h1>
        <p>You have been added as a user to project ${project.project_name}.</p>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Position:</strong> ${position}</p>
        <p><strong>Mobile No.:</strong> ${mobile}</p>
        <p><strong>Password:</strong> ${project.password}</p>
      `;

      const emailResponse = await sendEmail(
        email,
        `Project Invitation`,
        emailContent
      );

      if (!emailResponse.success) {
        console.error("Error sending email:", emailResponse.message);
      }
    }

    return res.status(200).json({
      message: "Users added successfully",
      project: result,
    });
  } catch (error) {
    console.error("Error while adding users to project:", error);
    res.status(500).json({
      message: "An error occurred while adding users to the project",
      error: error.message,
    });
  }
});

//! Delete User From Project
app.delete("/delete_user", async (req, res) => {
  try {
    const { userEmail, projectid } = req.body;

    if (!userEmail || !projectid) {
      return res
        .status(400)
        .json({ message: "User email and project ID are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(projectid)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const project = await ProjectDetails.findById(projectid);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    project.users = project.users.filter((user) => user.email !== userEmail);

    await project.save();

    const userResult = await User.deleteOne({
      email: userEmail,
      projectid: projectid,
    });

    if (userResult.deletedCount === 0) {
      console.log("user not found in user collection");
    }

    res.status(200).json({ message: "User deleted successfully from project" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      message: "An error occurred while deleting the user",
      error: error.message,
    });
  }
});

//! Delete Project
app.delete("/delete-project/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const result = await ProjectDetails.deleteOne({
      _id: mongoose.Types.ObjectId(projectId),
    });

    const userResult = await User.deleteMany({
      projectid: projectId.toString(),
    });

    res
      .status(200)
      .json({ message: "Project and associated users deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while deleting the project",
      error: error.message,
    });
  }
});

const calculatePercentile = (data, percentile) => {
  if (data.length === 0) return null;
  const sorted = [...data].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = lower + 1;
  const weight = index - lower;

  if (upper >= sorted.length) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const findRasterMinMax = async (filePath) => {
  let bandNumber = 1;
  const fileBuffer = fs_tiff.readFileSync(filePath);
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  );
  const tiff = await fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage(bandNumber - 1); // Zero-based index

  // Read the raster data
  const rasters = await image.readRasters();
  const data = rasters[0]; // Assuming single band

  // Handle NoData values
  const noData = image.getGDALNoData();
  if (noData !== undefined) {
    // console.log(`NoData value: ${noData}`);
  }

  const validData = data.filter(
    (value) => (noData === undefined || value !== noData) && !isNaN(value)
  );

  if (validData.length === 0) {
    throw new Error("No valid raster data found");
  }

  // Safe way to calculate min/max
  const min = validData.reduce((a, b) => Math.min(a, b), Infinity);
  const max = calculatePercentile(validData, 90);

  // console.log("Min:", min);
  // console.log("Max:", max);

  return { min, max };
};

//! Upload File
app.post("/upload-file", async (req, res) => {
  try {
    const { projectid, filename, filetype, scenario, legend_unit } = req.body;
    const file = req.files?.file;

    if (
      !projectid ||
      !filename ||
      !file ||
      !filetype ||
      (filetype === "flood_maps" && (!scenario || !legend_unit))
    ) {
      return res.status(400).json({
        message:
          "Project ID, filename, file, filetype, scenario (for flood maps), and legend_unit (for flood maps) are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(projectid)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const project = await ProjectDetails.findById(projectid);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const uploadPath = path.join(
      __dirname,
      "media",
      projectid,
      filetype === "flood_maps" ? scenario : ""
    );
    await fs.mkdir(uploadPath, { recursive: true });

    const fileExtension = path.extname(file.name);
    const newFileName = `${filename}${fileExtension}`;
    const fullPath = path.join(uploadPath, newFileName);

    await file.mv(fullPath);
    const fileUrl = path.join(
      "media",
      projectid,
      filetype === "flood_maps" ? scenario : "",
      newFileName
    );

    if (
      [
        "dam_images",
        "dam_videos",
        "flood_maps",
        "reports_file",
        "GeoJSON_file",
      ].includes(filetype)
    ) {
      const existingFile = project[filetype]?.find(
        (f) =>
          f.file_name.toLowerCase() === filename.toLowerCase() &&
          (filetype !== "flood_maps" || f.scenario === scenario)
      );
      if (existingFile) {
        return res
          .status(400)
          .json({ message: "A file with this name already exists." });
      }
    }

    let updateQuery = {};

    switch (filetype) {
      case "thumbnail_image":
        updateQuery = { thumbnail_image: fileUrl };
        await ProjectDetails.findByIdAndUpdate(projectid, updateQuery);
        break;
      case "dam_images":
        updateQuery = {
          $push: { dam_images: { file_name: filename, file_url: fileUrl } },
        };
        await ProjectDetails.findByIdAndUpdate(projectid, updateQuery);
        break;
      case "dam_videos":
        updateQuery = {
          $push: { dam_videos: { file_name: filename, file_url: fileUrl } },
        };
        await ProjectDetails.findByIdAndUpdate(projectid, updateQuery);
        break;
      case "flood_maps":
        let min_value, max_value;
        // console.log(min_value);
        try {
          const { min, max } = await findRasterMinMax(fullPath);
          min_value = min.toFixed(2);
          max_value = max.toFixed(2);
        } catch (err) {
          return res.status(500).json({
            message: "Error while computing raster min and max",
            error: err.message,
          });
        }
        updateQuery = {
          $push: {
            flood_maps: {
              file_name: filename,
              file_url: fileUrl,
              min: min_value,
              max: max_value,
              scenario: scenario,
              legend_unit: legend_unit,
            },
          },
        };
        await ProjectDetails.findByIdAndUpdate(projectid, updateQuery);
        break;
      case "GeoJSON_file":
        updateQuery = {
          $push: { GeoJSON_file: { file_name: filename, file_url: fileUrl } },
        };
        await ProjectDetails.findByIdAndUpdate(projectid, updateQuery);
        break;
      case "reports_file":
        updateQuery = {
          $push: { reports_file: { file_name: filename, file_url: fileUrl } },
        };
        await ProjectDetails.findByIdAndUpdate(projectid, updateQuery);
        break;
      default:
        return res.status(400).json({ message: "Invalid filetype" });
    }

    res
      .status(200)
      .json({ message: "File Uploaded Successfully", file: newFileName });
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while uploading the file",
      error: error.message,
    });
  }
});

const convertGeoTiffToPng = async (filePath, colorsArray) => {
  try {
    const fileBuffer = fs_tiff.readFileSync(filePath);
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    );
    const tiff = await fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage(0); // Assuming first image
    const rasters = await image.readRasters();
    const width = image.getWidth();
    const height = image.getHeight();
    const data = rasters[0]; // Assuming single band raster

    // Get min and max for normalization
    const { min, max } = await findRasterMinMax(filePath);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(width, height);

    const numColors = colorsArray.length;
    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      if (value === image.getGDALNoData() || isNaN(value)) {
        imageData.data[i * 4 + 3] = 0; // Transparent for no-data
      } else {
        const normalized = (value - min) / (max - min); // 0 to 1
        const colorIndex = Math.min(
          numColors - 1,
          Math.floor(normalized * numColors)
        );
        const hexColor = colorsArray[colorIndex];
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        imageData.data[i * 4] = r; // R
        imageData.data[i * 4 + 1] = g; // G
        imageData.data[i * 4 + 2] = b; // B
        imageData.data[i * 4 + 3] = 255; // A (opaque)
      }
    }

    ctx.putImageData(imageData, 0, 0);
    const pngPath = filePath.replace(".tif", ".png").replace(".tiff", ".png");
    const out = fs_tiff.createWriteStream(pngPath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);

    return new Promise((resolve, reject) => {
      out.on("finish", () => resolve(pngPath));
      out.on("error", reject);
    });
  } catch (error) {
    throw new Error(`Failed to convert GeoTIFF to PNG: ${error.message}`);
  }
};

app.post("/convert-geotiff-to-png", async (req, res) => {
  try {
    const { projectId, scenario, filename, colors } = req.body;

    if (!projectId || !scenario || !filename || !colors) {
      return res.status(400).json({
        message: "projectId, scenario, filename, and colors are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const project = await ProjectDetails.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const geotiffPath = path.join(
      __dirname,
      "media",
      projectId,
      scenario,
      filename
    );
    if (!fs_tiff.existsSync(geotiffPath)) {
      return res.status(404).json({ message: "GeoTIFF file not found" });
    }

    const pngPath = await convertGeoTiffToPng(geotiffPath, colors);
    const pngUrl = path.join(
      "media",
      projectId,
      scenario,
      path.basename(pngPath)
    );

    // Optionally, get bounds from GeoTIFF (requires geotiff library)
    const fileBuffer = fs_tiff.readFileSync(geotiffPath);
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    );
    const tiff = await fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage(0);
    const [minLon, minLat, maxLon, maxLat] = image.getBoundingBox();

    res.status(200).json({
      message: "GeoTIFF converted to PNG successfully",
      pngUrl: pngUrl,
      bounds: {
        southWest: { latitude: minLat, longitude: minLon },
        northEast: { latitude: maxLat, longitude: maxLon },
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error converting GeoTIFF to PNG",
      error: error.message,
    });
  }
});

//! Delete File
app.delete("/delete-file", async (req, res) => {
  try {
    const { fileID, projectid, fileType } = req.body;
    // console.log(fileID, projectid, fileType);

    if (!fileID || !projectid || !fileType) {
      return res
        .status(400)
        .json({ message: "File URL, project ID, and file type are required." });
    }

    const project = await ProjectDetails.findById(projectid);
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    if (!Array.isArray(project[fileType])) {
      return res.status(400).json({ message: "Invalid file type in project." });
    }

    let deletedFile = project[fileType].find(
      (file) => file._id.toString() == fileID
    );
    project[fileType] = project[fileType].filter(
      (file) => file._id.toString() !== fileID
    );
    await project.save();
    const filePath = path.join(__dirname, deletedFile.file_url);
    // console.log("filePath", filePath);

    try {
      await fs.unlink(filePath);
      // console.log("File deleted successfully:", filePath);
    } catch (err) {
      console.error("Error accessing or deleting file:", err.message);
    }

    res.status(200).json({ message: "File deleted successfully." });
  } catch (error) {
    console.error("Error deleting file:", error.message);
    res.status(500).json({
      message: "An error occurred during file deletion.",
      error: error.message,
    });
  }
});

//! Get Dams For User
app.get("/dams-for-user", async (req, res) => {
  try {
    const { userEmail } = req.query;
    if (!userEmail) {
      return res.status(400).json({ message: "User email is required." });
    }
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    const userProjectIds = await User.find({ email: userEmail }).distinct(
      "projectid"
    );
    if (!userProjectIds || userProjectIds.length === 0) {
      return res
        .status(404)
        .json({ message: "No project assigned to this user" });
    }

    // Find dams associated with those project IDs
    const dams = await ProjectDetails.find({ _id: { $in: userProjectIds } });

    res.status(200).json({ dams });
  } catch (error) {
    console.error("Error fetching dams for user:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch dams.", error: error.message });
  }
});

//! ReportIssue Route
app.post("/report-issue", async (req, res) => {
  const { projectId, issueIn, priority, description, reportedBy, timestamp } =
    req.body;
  let assignedTo;
  try {
    assignedTo = JSON.parse(req.body.assignedTo);
  } catch (parseError) {
    return res.status(400).json({ message: "Invalid assignedTo data." });
  }

  if (
    !projectId ||
    !issueIn ||
    !priority ||
    !description ||
    !reportedBy ||
    !assignedTo ||
    !timestamp
  ) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const project = await ProjectDetails.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    const uploadPath = path.join(__dirname, "media", projectId);
    await fs.mkdir(uploadPath, { recursive: true });

    let report_images = [];
    let report_videos = [];

    if (req.files) {
      if (req.files.fileInputImage) {
        if (Array.isArray(req.files.fileInputImage)) {
          for (const file of req.files.fileInputImage) {
            const newFileName = `${Date.now()}_img${path.extname(file.name)}`;
            const fullPath = path.join(uploadPath, newFileName);
            await file.mv(fullPath);
            report_images.push(path.join("media", projectId, newFileName));
          }
        } else {
          const file = req.files.fileInputImage;
          const newFileName = `${Date.now()}_img${path.extname(file.name)}`;
          const fullPath = path.join(uploadPath, newFileName);
          await file.mv(fullPath);
          report_images.push(path.join("media", projectId, newFileName));
        }
      }

      if (req.files.fileInputVideo) {
        if (Array.isArray(req.files.fileInputVideo)) {
          for (const file of req.files.fileInputVideo) {
            const newFileName = `${Date.now()}_vid${path.extname(file.name)}`;
            const fullPath = path.join(uploadPath, newFileName);
            await file.mv(fullPath);
            report_videos.push(path.join("media", projectId, newFileName));
          }
        } else {
          const file = req.files.fileInputVideo;
          const newFileName = `${Date.now()}_vid${path.extname(file.name)}`;
          const fullPath = path.join(uploadPath, newFileName);
          await file.mv(fullPath);
          report_videos.push(path.join("media", projectId, newFileName));
        }
      }
    }

    const newReport = {
      reportedBy,
      issueIn,
      priority,
      description,
      report_images,
      report_videos,
      assignedTo,
      timestamp,
    };

    project.Reports.push(newReport);
    await project.save();

    res.status(200).json({ message: "Report created successfully." });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Failed to create report. Please try again." });
  }
});

//! show report in respond issue section
app.get("/reports/:projectId/:userEmail", async (req, res) => {
  const { projectId, userEmail } = req.params;
  try {
    const project = await ProjectDetails.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const reports = project.Reports;
    res.status(200).json(reports);
  } catch (error) {
    res.status(500).json({ message: "Error fetching reports", error });
  }
});

//! Replay of report
app.post("/reports/respond", async (req, res) => {
  const { projectId, reportId, reply, repliedBy, rePriority, reassignedTo } = req.body;
  const imageFiles = req.files?.respond_images;
  const videoFiles = req.files?.respond_videos;

  if (!projectId || !reportId || (!reply && !imageFiles && !videoFiles) || !repliedBy) {
    return res.status(400).json({ message: "Missing required fields or no content provided" });
  }

  try {
    const project = await ProjectDetails.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const report = project.Reports.find((r) => r._id.toString() === reportId);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    const uploadPath = path.join(__dirname, "media", projectId);
    await fs.mkdir(uploadPath, { recursive: true });

    let respond_images = [];
    let respond_videos = [];

    if (imageFiles) {
      const images = Array.isArray(imageFiles) ? imageFiles : [imageFiles];
      for (const file of images) {
        const newFileName = `${Date.now()}_resp_img${path.extname(file.name)}`;
        const fullPath = path.join(uploadPath, newFileName);
        await file.mv(fullPath);
        respond_images.push(path.join("media", projectId, newFileName));
      }
    }

    if (videoFiles) {
      const videos = Array.isArray(videoFiles) ? videoFiles : [videoFiles];
      for (const file of videos) {
        const newFileName = `${Date.now()}_resp_vid${path.extname(file.name)}`;
        const fullPath = path.join(uploadPath, newFileName);
        await file.mv(fullPath);
        respond_videos.push(path.join("media", projectId, newFileName));
      }
    }

    report.responses.push({
      repliedBy,
      reply: reply || "",
      respond_images,
      respond_videos,
      rePriority,
      reassignedTo: JSON.parse(reassignedTo || "[]"),
      timestamp: new Date(),
    });

    await project.save();
    res.status(200).json({ message: "Response added successfully" });
  } catch (error) {
    console.error("Error adding response:", error);
    res.status(500).json({ message: "Error adding response", error: error.message });
  }
});

//! Responce and close Ticket
app.post("/reports/respond-and-close", async (req, res) => {
  const { projectId, reportId, reply, repliedBy, rePriority, reassignedTo} = req.body;
  const imageFiles = req.files?.respond_images;
  const videoFiles = req.files?.respond_videos;

  if (!projectId || !reportId || (!reply && !imageFiles && !videoFiles) || !repliedBy) {
    return res.status(400).json({ message: "Missing required fields or no content provided" });
  }

  try {
    const project = await ProjectDetails.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const report = project.Reports.find((r) => r._id.toString() === reportId);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    const uploadPath = path.join(__dirname, "media", projectId);
    await fs.mkdir(uploadPath, { recursive: true });

    let respond_images = [];
    let respond_videos = [];

    if (imageFiles) {
      const images = Array.isArray(imageFiles) ? imageFiles : [imageFiles];
      for (const file of images) {
        const newFileName = `${Date.now()}_resp_img${path.extname(file.name)}`;
        const fullPath = path.join(uploadPath, newFileName);
        await file.mv(fullPath);
        respond_images.push(path.join("media", projectId, newFileName));
      }
    }

    if (videoFiles) {
      const videos = Array.isArray(videoFiles) ? videoFiles : [videoFiles];
      for (const file of videos) {
        const newFileName = `${Date.now()}_resp_vid${path.extname(file.name)}`;
        const fullPath = path.join(uploadPath, newFileName);
        await file.mv(fullPath);
        respond_videos.push(path.join("media", projectId, newFileName));
      }
    }

    report.responses.push({
      repliedBy,
      reply: reply || "",
      respond_images,
      respond_videos,
      rePriority,
      reassignedTo: JSON.parse(reassignedTo || "[]"),
      timestamp: new Date(),
    });
    report.isActive = false;

    await project.save();
    res.status(200).json({ message: "Response added and ticket closed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error adding response and closing ticket", error });
  }
});

//! Active and Inactive Reports
app.post("/reports/active", async (req, res) => {
  const { projectId, reportID, changedBy } = req.body;
  try {
    const project = await ProjectDetails.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const filteredReport = project.Reports.find(
      (report) => report._id.toString() === reportID
    );
    if (!filteredReport) {
      return res.status(404).json({ message: "Report not found" });
    }

    // console.log("filteredReport", filteredReport);
    filteredReport.isActive = !filteredReport.isActive;
    filteredReport.statusChangedBy = changedBy;
    filteredReport.statusChangedAt = new Date();
    await project.save();

    res.status(200).json({ message: "Report status updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error updating report", error });
  }
});

//! Add water and Show
app.post("/water-level/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { value, unit, addedBy, date } = req.body;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }
    if (!value || !unit) {
      return res.status(400).json({ message: "Value and Unit are required" });
    }

    const project = await ProjectDetails.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    const timestamp = date ? new Date(date) : new Date();
    project.water_levels.push({ value, unit, addedBy, timestamp });
    await project.save();

    res.status(200).json({ message: "Water level added successfully" });
  } catch (error) {
    console.error("Error adding water level:", error);
    res.status(500).json({ message: "Failed to add water level" });
  }
});

//! Discharge water and Show
app.post("/discharge-level/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { value, unit, addedBy, date } = req.body;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }
    if (!value || !unit) {
      return res.status(400).json({ message: "Value and Unit are required" });
    }

    const project = await ProjectDetails.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    const timestamp = date ? new Date(date) : new Date();
    project.discharge_levels.push({ value, unit, addedBy, timestamp });
    await project.save();

    res
      .status(200)
      .json({ message: "Discharge Water level added successfully" });
  } catch (error) {
    console.error("Error adding water level:", error);
    res.status(500).json({ message: "Failed to add water level" });
  }
});

//! Route to add Hydro-Meteorological Instruments data
app.post("/hydro-meteorological/:projectid", async (req, res) => {
  const { projectid } = req.params;
  const {
    nameOfInstrument,
    numberOfInstruments,
    location,
    sinceWhenInstalled,
    workingCondition,
    dateLastNextCalibration,
    observationsMaintained,
    agencyResponsible,
    analysisDoneAtFieldLevel,
    dataSentToDSO,
    remarks,
    addedBy,
  } = req.body;

  try {
    const project = await ProjectDetails.findById(projectid);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const uploadPath = path.join(__dirname, "media", projectid);
    await fs.mkdir(uploadPath, { recursive: true });

    let hydroMeteorological_images = [];
    let hydroMeteorological_videos = [];

    if (req.files) {
      if (req.files.fileInputImage) {
        if (Array.isArray(req.files.fileInputImage)) {
          for (const file of req.files.fileInputImage) {
            const newFileName = `${Date.now()}_img${path.extname(file.name)}`;
            const fullPath = path.join(uploadPath, newFileName);
            await file.mv(fullPath);
            hydroMeteorological_images.push(
              path.join("media", projectid, newFileName)
            );
          }
        } else {
          const file = req.files.fileInputImage;
          const newFileName = `${Date.now()}_img${path.extname(file.name)}`;
          const fullPath = path.join(uploadPath, newFileName);
          await file.mv(fullPath);
          hydroMeteorological_images.push(
            path.join("media", projectid, newFileName)
          );
        }
      }

      // Handle video uploads
      if (req.files.fileInputVideo) {
        if (Array.isArray(req.files.fileInputVideo)) {
          for (const file of req.files.fileInputVideo) {
            const newFileName = `${Date.now()}_vid${path.extname(file.name)}`;
            const fullPath = path.join(uploadPath, newFileName);
            await file.mv(fullPath);
            hydroMeteorological_videos.push(
              path.join("media", projectid, newFileName)
            );
          }
        } else {
          const file = req.files.fileInputVideo;
          const newFileName = `${Date.now()}_vid${path.extname(file.name)}`;
          const fullPath = path.join(uploadPath, newFileName);
          await file.mv(fullPath);
          hydroMeteorological_videos.push(
            path.join("media", projectid, newFileName)
          );
        }
      }
    }

    const newInstrument = {
      nameOfInstrument,
      numberOfInstruments: parseInt(numberOfInstruments),
      location,
      sinceWhenInstalled,
      workingCondition,
      dateLastNextCalibration,
      observationsMaintained,
      agencyResponsible,
      analysisDoneAtFieldLevel,
      dataSentToDSO,
      remarks,
      addedBy,
      hydroMeteorological_images,
      hydroMeteorological_videos,
      timestamp: new Date(),
    };

    project.hydro_Meteorological_Instruments.push(newInstrument);
    await project.save();

    res.status(200).json({ message: "Instrument added successfully" });
  } catch (error) {
    console.error("Error adding Hydro-Meteorological Instrument:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

//! Route to add Geo-Technical Instruments data
app.post("/geo-Technical/:projectid", async (req, res) => {
  const { projectid } = req.params;
  const {
    nameOfInstrument,
    numberOfInstruments,
    location,
    sinceWhenInstalled,
    workingCondition,
    dateLastNextCalibration,
    observationsMaintained,
    agencyResponsible,
    analysisDoneAtFieldLevel,
    dataSentToDSO,
    remarks,
    addedBy,
  } = req.body;

  try {
    const project = await ProjectDetails.findById(projectid);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const uploadPath = path.join(__dirname, "media", projectid);
    await fs.mkdir(uploadPath, { recursive: true });

    let geoTechnical_images = [];
    let geoTechnical_videos = [];

    if (req.files) {
      if (req.files.fileInputImage) {
        if (Array.isArray(req.files.fileInputImage)) {
          for (const file of req.files.fileInputImage) {
            const newFileName = `${Date.now()}_img${path.extname(file.name)}`;
            const fullPath = path.join(uploadPath, newFileName);
            await file.mv(fullPath);
            geoTechnical_images.push(
              path.join("media", projectid, newFileName)
            );
          }
        } else {
          const file = req.files.fileInputImage;
          const newFileName = `${Date.now()}_img${path.extname(file.name)}`;
          const fullPath = path.join(uploadPath, newFileName);
          await file.mv(fullPath);
          geoTechnical_images.push(path.join("media", projectid, newFileName));
        }
      }

      // Handle video uploads
      if (req.files.fileInputVideo) {
        if (Array.isArray(req.files.fileInputVideo)) {
          for (const file of req.files.fileInputVideo) {
            const newFileName = `${Date.now()}_vid${path.extname(file.name)}`;
            const fullPath = path.join(uploadPath, newFileName);
            await file.mv(fullPath);
            geoTechnical_videos.push(
              path.join("media", projectid, newFileName)
            );
          }
        } else {
          const file = req.files.fileInputVideo;
          const newFileName = `${Date.now()}_vid${path.extname(file.name)}`;
          const fullPath = path.join(uploadPath, newFileName);
          await file.mv(fullPath);
          geoTechnical_videos.push(path.join("media", projectid, newFileName));
        }
      }
    }

    const newInstrument = {
      nameOfInstrument,
      numberOfInstruments: parseInt(numberOfInstruments),
      location,
      sinceWhenInstalled,
      workingCondition,
      dateLastNextCalibration,
      observationsMaintained,
      agencyResponsible,
      analysisDoneAtFieldLevel,
      dataSentToDSO,
      remarks,
      addedBy,
      geoTechnical_images,
      geoTechnical_videos,
      timestamp: new Date(),
    };

    project.geo_Technical_Instruments.push(newInstrument);
    await project.save();

    res.status(200).json({ message: "Instrument added successfully" });
  } catch (error) {
    console.error("Error adding Hydro-Meteorological Instrument:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

//! Route to add Geodetic Instruments data
app.post("/geodetic/:projectid", async (req, res) => {
  const { projectid } = req.params;
  const {
    nameOfInstrument,
    numberOfInstruments,
    location,
    sinceWhenInstalled,
    workingCondition,
    dateLastNextCalibration,
    observationsMaintained,
    agencyResponsible,
    analysisDoneAtFieldLevel,
    dataSentToDSO,
    remarks,
    addedBy,
  } = req.body;

  try {
    const project = await ProjectDetails.findById(projectid);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const uploadPath = path.join(__dirname, "media", projectid);
    await fs.mkdir(uploadPath, { recursive: true });

    let geodetic_images = [];
    let geodetic_videos = [];

    if (req.files) {
      // Handle image uploads
      if (req.files.fileInputImage) {
        if (Array.isArray(req.files.fileInputImage)) {
          for (const file of req.files.fileInputImage) {
            const newFileName = `${Date.now()}_img${path.extname(file.name)}`;
            const fullPath = path.join(uploadPath, newFileName);
            await file.mv(fullPath);
            geodetic_images.push(path.join("media", projectid, newFileName));
          }
        } else {
          const file = req.files.fileInputImage;
          const newFileName = `${Date.now()}_img${path.extname(file.name)}`;
          const fullPath = path.join(uploadPath, newFileName);
          await file.mv(fullPath);
          geodetic_images.push(path.join("media", projectid, newFileName));
        }
      }

      // Handle video uploads
      if (req.files.fileInputVideo) {
        if (Array.isArray(req.files.fileInputVideo)) {
          for (const file of req.files.fileInputVideo) {
            const newFileName = `${Date.now()}_vid${path.extname(file.name)}`;
            const fullPath = path.join(uploadPath, newFileName);
            await file.mv(fullPath);
            geodetic_videos.push(path.join("media", projectid, newFileName));
          }
        } else {
          const file = req.files.fileInputVideo;
          const newFileName = `${Date.now()}_vid${path.extname(file.name)}`;
          const fullPath = path.join(uploadPath, newFileName);
          await file.mv(fullPath);
          geodetic_videos.push(path.join("media", projectid, newFileName));
        }
      }
    }

    const newInstrument = {
      nameOfInstrument,
      numberOfInstruments: parseInt(numberOfInstruments),
      location,
      sinceWhenInstalled,
      workingCondition,
      dateLastNextCalibration,
      observationsMaintained,
      agencyResponsible,
      analysisDoneAtFieldLevel,
      dataSentToDSO,
      remarks,
      addedBy,
      geodetic_images,
      geodetic_videos,
      timestamp: new Date(),
    };

    project.geodetic_Instruments.push(newInstrument);
    await project.save();

    res.status(200).json({ message: "Instrument added successfully" });
  } catch (error) {
    console.error("Error adding Hydro-Meteorological Instrument:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

//! Route to add Seismic Instruments data
app.post("/seismic/:projectid", async (req, res) => {
  const { projectid } = req.params;
  const {
    nameOfInstrument,
    numberOfInstruments,
    location,
    sinceWhenInstalled,
    workingCondition,
    dateLastNextCalibration,
    observationsMaintained,
    agencyResponsible,
    analysisDoneAtFieldLevel,
    dataSentToDSO,
    remarks,
    addedBy,
  } = req.body;

  try {
    const project = await ProjectDetails.findById(projectid);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const uploadPath = path.join(__dirname, "media", projectid);
    await fs.mkdir(uploadPath, { recursive: true });

    let seismic_images = [];
    let seismic_videos = [];

    if (req.files) {
      // Handle image uploads
      if (req.files.fileInputImage) {
        if (Array.isArray(req.files.fileInputImage)) {
          for (const file of req.files.fileInputImage) {
            const newFileName = `${Date.now()}_img${path.extname(file.name)}`;
            const fullPath = path.join(uploadPath, newFileName);
            await file.mv(fullPath);
            seismic_images.push(path.join("media", projectid, newFileName));
          }
        } else {
          const file = req.files.fileInputImage;
          const newFileName = `${Date.now()}_img${path.extname(file.name)}`;
          const fullPath = path.join(uploadPath, newFileName);
          await file.mv(fullPath);
          seismic_images.push(path.join("media", projectid, newFileName));
        }
      }

      // Handle video uploads
      if (req.files.fileInputVideo) {
        if (Array.isArray(req.files.fileInputVideo)) {
          for (const file of req.files.fileInputVideo) {
            const newFileName = `${Date.now()}_vid${path.extname(file.name)}`;
            const fullPath = path.join(uploadPath, newFileName);
            await file.mv(fullPath);
            seismic_videos.push(path.join("media", projectid, newFileName));
          }
        } else {
          const file = req.files.fileInputVideo;
          const newFileName = `${Date.now()}_vid${path.extname(file.name)}`;
          const fullPath = path.join(uploadPath, newFileName);
          await file.mv(fullPath);
          seismic_videos.push(path.join("media", projectid, newFileName));
        }
      }
    }

    const newInstrument = {
      nameOfInstrument,
      numberOfInstruments: parseInt(numberOfInstruments),
      location,
      sinceWhenInstalled,
      workingCondition,
      dateLastNextCalibration,
      observationsMaintained,
      agencyResponsible,
      analysisDoneAtFieldLevel,
      dataSentToDSO,
      remarks,
      addedBy,
      seismic_images,
      seismic_videos,
      timestamp: new Date(),
    };

    project.seismic_Instruments.push(newInstrument);
    await project.save();

    res.status(200).json({ message: "Instrument added successfully" });
  } catch (error) {
    console.error("Error adding Hydro-Meteorological Instrument:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default app;

// **Root Route**
app.get("/", (req, res) => {
  res.send("Welcome to my backend server");
});

// **404 Route**
app.all("*", (req, res) => {
  res.status(404).json({ message: "404 Not Found" });
});

// **Server Listening**
app.listen(PORT, () => {
  console.log(`Backend started at port ${PORT}`);
});
