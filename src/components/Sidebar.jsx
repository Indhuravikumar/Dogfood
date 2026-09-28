import { NavLink } from "react-router-dom";
import { LayoutDashboard, CalendarDays, Users, FileText, Image, Settings, LogOut, Trophy } from "lucide-react";

export default function Sidebar() {
  const menu = [
    ["Dashboard", "/", LayoutDashboard],
    ["Events", "/events", CalendarDays],
    ["Teams", "/teams", Users],
    ["Submissions", "/submissions", FileText],
    ["Gallery", "/gallery", Image]
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon"><Trophy size={20} /></div>
        <div><h2>DogFood</h2><span>Hackathon OS</span></div>
      </div>
      <div className="menu-title">WORKSPACE</div>
      <nav>
        {menu.map(([name, path, Icon]) => (
          <NavLink key={name} to={path} className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <Icon size={19} /><span>{name}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <NavLink to="/settings" className="nav-item"><Settings size={19}/><span>Settings</span></NavLink>
        <div className="profile-mini">
          <div className="avatar">IN</div>
          <div><strong>Indhu</strong><small>Organizer</small></div>
          <LogOut size={17}/>
        </div>
      </div>
    </aside>
  );
}