import Icon from "../common/Icon";
import { STUDYING_SINCE } from "../../config/profile";

interface SidebarAccountProps {
	userName?: string | null;
	onOpenProfile: () => void;
	onLogout: () => void;
}

const profileButtonClass =
	"group relative -m-1 flex min-w-0 flex-auto cursor-pointer items-center gap-[9px] rounded-[3px] border-0 bg-transparent p-1 text-left text-[inherit] transition-colors duration-[120ms] ease-out hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none motion-reduce:transition-none";

const tooltipClass =
	"pointer-events-none absolute bottom-[calc(100%+6px)] left-1 translate-y-[3px] whitespace-nowrap rounded-[2px] bg-[#f1f3f3] px-2 py-1.25 text-[10px] font-semibold text-[#25282d] opacity-0 transition-[opacity,transform] duration-[120ms] ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 motion-reduce:transition-none";

export default function SidebarAccount({
	userName,
	onOpenProfile,
	onLogout,
}: SidebarAccountProps) {
	const initials = (userName || "U")
		.split(" ")
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	return (
		<div className="account-footer">
			<button
				type="button"
				className={profileButtonClass}
				onClick={onOpenProfile}
				aria-label="Open your profile"
			>
				<div className="account-avatar" aria-hidden="true">
					{initials}
				</div>
				<div className="account-meta min-w-0">
					<strong className="account-name block truncate text-[#f1f3f3]">
						{userName || "Student"}
					</strong>
					<span className="account-since">Studying since {STUDYING_SINCE}</span>
				</div>
				<span className={tooltipClass} aria-hidden="true">
					View profile
				</span>
			</button>
			<button
				type="button"
				className="account-logout"
				aria-label="Log out"
				title="Log out"
				onClick={onLogout}
			>
				<Icon name="logout" size={17} />
			</button>
		</div>
	);
}
