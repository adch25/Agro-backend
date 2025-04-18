import mongoose from "mongoose";
const projectSchema = new mongoose.Schema({
  users: Array,
  project_name: String,
  department_name: String,
  address: String,
  purpose_of_dam: [String],
  dam_height: { value: Number, unit: String },
  hfl: { value: Number, unit: String },
  mrl: { value: Number, unit: String },
  reservoir_area: { value: Number, unit: String },
  reservoir_volume: { value: Number, unit: String },
  hydropower_capacity: { value: Number, unit: String },
  project_description: String,
  latitude: Number,
  longitude: Number,
  registration_time: { type: Date, default: Date.now },
  thumbnail_image: String,
  dam_images: [
    {
      file_name: String,
      file_url: String,
    },
  ],
  dam_videos: [
    {
      file_name: String,
      file_url: String,
    },
  ],
  flood_maps: [
    {
      file_name: String,
      file_url: String,
      min: Number,
      max: Number,
      scenario: String,
      legend_unit: String,
    },
  ],
  reports_file: [
    {
      file_name: String,
      file_url: String,
    },
  ],
  GeoJSON_file: [
    {
      file_name: String,
      file_url: String,
    },
  ],
  password: String,
  water_levels: [
    {
      reportedBy: String,
      value: Number,
      unit: String,
      addedBy: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
  discharge_levels: [
    {
      reportedBy: String,
      value: Number,
      unit: String,
      addedBy: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
  Reports: [
    {
      reportedBy: String,
      issueIn: String,
      priority: String,
      description: String,
      report_images: Array,
      report_videos: Array,
      timestamp: Date,
      isActive: {
        type: Boolean,
        default: true,
      },
      assignedTo: [String],
      statusChangedBy: String,
      statusChangedAt: {
        type: Date,
        default: Date.now,
      },
      responses: [
        {
          repliedBy: String,
          reply: String,
          respond_images: [String], 
          respond_videos: [String], 
          reassignedTo: [String],
          rePriority: String,
          timestamp: Date,
        },
      ],
    },
  ],
  hydro_Meteorological_Instruments: [
    {
      nameOfInstrument: String,
      numberOfInstruments: Number,
      location: String,
      sinceWhenInstalled: String,
      workingCondition: String,
      dateLastNextCalibration: String,
      observationsMaintained: String,
      agencyResponsible: String,
      analysisDoneAtFieldLevel: String,
      dataSentToDSO: String,
      remarks: String,
      addedBy: String,
      hydroMeteorological_images: [String], 
      hydroMeteorological_videos: [String], 
      timestamp: { type: Date, default: Date.now },
    },
  ],
  geo_Technical_Instruments: [
    {
      nameOfInstrument: String,
      numberOfInstruments: Number,
      location: String,
      sinceWhenInstalled: String,
      workingCondition: String,
      dateLastNextCalibration: String,
      observationsMaintained: String,
      agencyResponsible: String,
      analysisDoneAtFieldLevel: String,
      dataSentToDSO: String,
      remarks: String,
      addedBy: String,
      geoTechnical_images: [String], 
      geoTechnical_videos: [String], 
      timestamp: { type: Date, default: Date.now },
    },
  ],
  geodetic_Instruments: [
    {
      nameOfInstrument: String,
      numberOfInstruments: Number,
      location: String,
      sinceWhenInstalled: String,
      workingCondition: String,
      dateLastNextCalibration: String,
      observationsMaintained: String,
      agencyResponsible: String,
      analysisDoneAtFieldLevel: String,
      dataSentToDSO: String,
      remarks: String,
      addedBy: String,
      geodetic_images: [String], 
      geodetic_videos: [String], 
      timestamp: { type: Date, default: Date.now },
    },
  ],
  seismic_Instruments: [
    {
      nameOfInstrument: String,
      numberOfInstruments: Number,
      location: String,
      sinceWhenInstalled: String,
      workingCondition: String,
      dateLastNextCalibration: String,
      observationsMaintained: String,
      agencyResponsible: String,
      analysisDoneAtFieldLevel: String,
      dataSentToDSO: String,
      remarks: String,
      addedBy: String,
      seismic_images: [String], 
      seismic_videos: [String], 
      timestamp: { type: Date, default: Date.now },
    },
  ],
});
const ProjectDetails = mongoose.model("projects", projectSchema);
export default ProjectDetails;
