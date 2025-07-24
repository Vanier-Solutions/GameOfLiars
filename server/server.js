import express from "express";
import cors from "cors";
import connectDB from "./db/connection.js";
import lobbyRoutes from "./routes/lobby.js";
const PORT = process.env.PORT || 5051;
const app = express();

await connectDB();

app.use(cors()); // TODO: Need to add specific origin
app.use(express.json());

// API Routes
app.use("/api/lobby", lobbyRoutes);



app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});