import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { Search, Heart, ExternalLink } from "lucide-react";

export default function Gallery() {
  const projects = [
    ["FarmGuard AI","Team Synkrons","AI-powered crop monitoring and intelligent farming recommendations.",["AI","Agriculture"],128],
    ["CivicPulse","Code Catalysts","Smart civic issue reporting and resolution platform.",["AI","CivicTech"],96],
    ["HealthBridge","Neural Labs","Accessible digital healthcare assistant for communities.",["Healthcare","ML"],81],
    ["GreenGrid","EcoCoders","Smart energy optimization platform for sustainable cities.",["Climate","IoT"],74]
  ];
  return (
    <div className="app"><Sidebar/><main className="main">
      <Topbar title="Project Gallery" description="Explore projects submitted by the community."/>
      <div className="gallery-toolbar"><div className="gallery-search"><Search size={18}/><input placeholder="Search projects, teams or technologies..."/></div><select><option>All Events</option><option>AI Innovation Challenge</option><option>Web3 Builders Sprint</option></select><select><option>All Tracks</option><option>Artificial Intelligence</option><option>Climate Tech</option></select></div>
      <div className="project-grid">
        {projects.map(p => <div className="project-card" key={p[0]}>
          <div className="project-image"><div className="project-gradient">{p[0].substring(0,2)}</div><button className="heart-button"><Heart size={17}/></button></div>
          <div className="project-content"><div className="project-tags">{p[3].map(t => <span key={t}>{t}</span>)}</div><h2>{p[0]}</h2><p>{p[2]}</p>
            <div className="project-team"><div className="small-avatar">{p[1].substring(0,2)}</div><span>{p[1]}</span></div>
            <div className="project-footer"><span><Heart size={15}/>{p[4]}</span><button>View Project <ExternalLink size={14}/></button></div>
          </div>
        </div>)}
      </div>
    </main></div>
  );
}