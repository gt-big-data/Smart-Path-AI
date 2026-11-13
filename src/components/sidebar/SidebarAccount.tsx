import Icon from "../common/Icon";

interface SidebarAccountProps {
	userName?: string | null;
	onLogout: () => void;
}

export default function SidebarAccount({
	userName,
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
			<div className="account-avatar">{initials}</div>
			<div>
				<strong>{userName || "Student"}</strong>
				<span>Student plan</span>
			</div>
			<button
				type="button"
				aria-label="Log out"
				title="Log out"
				onClick={onLogout}
			>
				<Icon name="logout" size={17} />
			</button>
		</div>
	);
}
