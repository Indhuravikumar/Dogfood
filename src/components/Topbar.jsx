import { Bell, Search, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Topbar({ title, description }) {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      <div><h1>{title}</h1><p>{description}</p></div>
      <div className="top-actions">
        <div className="search-box"><Search size={18}/><input placeholder="Search..."/><span>⌘ K</span></div>
        <button className="icon-button"><Bell size={19}/><i/></button>
        <button className="create-button" onClick={() => navigate("/events/create")}><Plus size={18}/>Create Event</button>
      </div>
    </header>
  );
}