import { Upload } from "lucide-react";
import {
	chooseButton,
	graphEmpty,
	graphEmptyBody,
	graphEmptyIcon,
	graphEmptyKicker,
	graphEmptyNote,
	graphEmptyTitle,
} from "./graphClasses";

interface GraphEmptyStateProps {
	onChooseFile?: () => void;
}

/** Shown in the knowledge map before a document has been turned into a graph */
export default function GraphEmptyState({
	onChooseFile,
}: GraphEmptyStateProps) {
	return (
		<div className={graphEmpty}>
			<span className={graphEmptyIcon}>
				<Upload size={25} strokeWidth={1.7} />
			</span>
			<span className={graphEmptyKicker}>Start with your material</span>
			<h2 className={graphEmptyTitle}>
				Build your first knowledge graph
			</h2>
			<p className={graphEmptyBody}>
				Upload a PDF, document, or set of notes. SmartPath will map the
				key concepts and connections for you.
			</p>
			{onChooseFile && (
				<button
					type="button"
					className={chooseButton}
					onClick={onChooseFile}
				>
					<Upload size={16} />
					<span>Choose a file</span>
				</button>
			)}
			<small className={graphEmptyNote}>
				PDF, DOCX, or TXT · up to 10 MB
			</small>
		</div>
	);
}
