import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { Plus, Calendar, Users, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Events() {
  const navigate = useNavigate();
  const events = [
    ["AI Innovation Challenge","Build practical AI solutions for real-world problems.",324,86,"LIVE","purple","Sep 25 – Sep 28, 2026"],
    ["Web3 Builders Sprint","Create decentralized applications for the next generation.",186,42,"LIVE","blue","Oct 02 – Oct 07, 2026"],
    ["Climate Tech Challenge","Technology solutions for a sustainable future.",98,27,"UPCOMING","orange","Oct 04 – Oct 10, 2026"]
  ];
  return (
    <div className="app"><Sidebar/><main className="main">
      <Topbar title="Events" description="Create and manage your hackathon events."/>
      <div className="page-actions">
        <div className="filter-tabs"><button className="filter active">All</button><button className="filter">Live</button><button className="filter">Upcoming</button><button className="filter">Completed</button></div>
        <button className="create-button" onClick={() => navigate("/events/create")}><Plus size={18}/>New Event</button>
      </div>
      <div className="event-cards">
        {events.map(e => <div className="big-event-card" key={e[0]}>
          <div className={`event-cover ${e[5]}`}><span className="event-badge">{e[4]}</span><div className="event-mark">{e[0].substring(0,2)}</div></div>
          <div className="big-event-content"><h2>{e[0]}</h2><p>{e[1]}</p>
            <div className="event-meta"><span><Calendar size={15}/>{e[6]}</span><span><Users size={15}/>{e[2]} participants</span></div>
            <div className="event-card-footer"><span>{e[3]} teams formed</span><button>Manage <ArrowUpRight size={15}/></button></div>
          </div>
        </div>)}
      </div>
    </main></div>
  );
}