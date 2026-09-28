import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function CreateEvent() {
  const navigate = useNavigate();
  return (
    <div className="app"><Sidebar/><main className="main">
      <Topbar title="Create Event" description="Set up a new hackathon for your community."/>
      <div className="form-container">
        <button className="back-button" onClick={() => navigate("/events")}><ArrowLeft size={17}/>Back to Events</button>
        <div className="form-panel">
          <div className="form-section"><h2>Event Details</h2><p>Basic information about your hackathon.</p>
            <div className="form-grid">
              <div className="field full"><label>Event Name</label><input placeholder="e.g. AI Innovation Challenge"/></div>
              <div className="field full"><label>Description</label><textarea rows="4" placeholder="Tell participants what this hackathon is about..."/></div>
              <div className="field"><label>Start Date</label><input type="datetime-local"/></div>
              <div className="field"><label>End Date</label><input type="datetime-local"/></div>
            </div>
          </div>
          <div className="form-section"><div className="section-title-row"><div><h2>Tracks</h2><p>Create categories for participants.</p></div><button className="outline-button"><Plus size={16}/>Add Track</button></div>
            <div className="track-row"><input placeholder="Track name"/><input placeholder="Description"/><button className="delete-button"><Trash2 size={17}/></button></div>
          </div>
          <div className="form-section"><div className="section-title-row"><div><h2>Prizes</h2><p>Define the prizes for your event.</p></div><button className="outline-button"><Plus size={16}/>Add Prize</button></div>
            <div className="prize-row"><input placeholder="Prize title"/><input placeholder="Amount / reward"/></div>
          </div>
          <div className="form-footer"><button className="cancel-button" onClick={() => navigate("/events")}>Cancel</button><button className="create-button">Create Event</button></div>
        </div>
      </div>
    </main></div>
  );
}