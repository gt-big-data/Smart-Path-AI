import { ReactNode, useEffect, useMemo, useRef } from "react";
import { Actions, DockLocation, Layout, Model, TabNode } from "flexlayout-react";
import "flexlayout-react/style/light.css";

/** Component key for tabs opened from the chat page (quiz, practice exam) */
const SIDE_TAB_COMPONENT = "side";

export interface DockTab {
  /** Unique tab id, also the flexlayout node id */
  id: string;
  name: string;
  content: ReactNode;
  /** Changes when a new session of this tab starts, so an already-open tab is brought to front */
  sessionKey: string;
  /** The user pressed the tab's close button. The parent decides whether to drop the tab from `tabs`. */
  onRequestClose: () => void;
}

interface WorkspaceDockProps {
  children: ReactNode;
  modelKey?: string;
  /** Side tabs that should be open. A tab missing from this list is closed. */
  tabs?: DockTab[];
}

export default function WorkspaceDock({ children, modelKey = "workspace", tabs = [] }: WorkspaceDockProps) {
  const model = useMemo(
    () =>
      Model.fromJson({
        global: {
          tabEnableClose: false,
          tabSetEnableMaximize: true,
          // splitterSize: 5,
          // splitterExtra: 4,
        },
        borders: [],
        layout: {
          type: "row",
          weight: 100,
          children: [
            {
              type: "tabset",
              id: "graph-set",
              weight: 54,
              children: [{ type: "tab", id: "tab-graph", name: "Knowledge Graph", component: "graph", enableClose: false }],
            },
            {
              type: "tabset",
              id: "assistant-set",
              weight: 46,
              children: [{ type: "tab", id: "tab-assistant", name: "Study Assistant", component: "assistant", enableClose: false }],
            },
          ],
        },
      }),
    [modelKey],
  );
  const panels = Array.isArray(children) ? children : [children];

  // Session key each open side tab was last opened with, to tell a new session from a re-render
  const openedKeys = useRef<Record<string, string>>({});

  // Open, focus or close side tabs so the layout matches `tabs`
  useEffect(() => {
    const wanted = new Set(tabs.map((tab) => tab.id));
    const stale: string[] = [];
    model.visitNodes((node) => {
      if (node.getType() === "tab" && (node as TabNode).getComponent() === SIDE_TAB_COMPONENT && !wanted.has(node.getId())) {
        stale.push(node.getId());
      }
    });
    stale.forEach((id) => {
      delete openedKeys.current[id];
      model.doAction(Actions.deleteTab(id));
    });

    for (const tab of tabs) {
      if (!model.getNodeById(tab.id)) {
        model.doAction(
          Actions.addNode(
            { type: "tab", id: tab.id, name: tab.name, component: SIDE_TAB_COMPONENT, enableClose: true },
            "graph-set",
            DockLocation.CENTER,
            -1,
            true,
          ),
        );
      } else if (openedKeys.current[tab.id] !== tab.sessionKey) {
        model.doAction(Actions.selectTab(tab.id));
      }
      openedKeys.current[tab.id] = tab.sessionKey;
    }
  }, [model, tabs]);

  return (
    <section className="workspace-dock">
      <div className="workspace-dock-content flexlayout-workspace">
        <Layout
          model={model}
          factory={(node: TabNode) => {
            const component = node.getComponent();
            if (component === SIDE_TAB_COMPONENT) {
              return tabs.find((tab) => tab.id === node.getId())?.content ?? null;
            }
            return panels[component === "graph" ? 0 : 1] ?? null;
          }}
          onAction={(action) => {
            if (action.type === Actions.DELETE_TAB) {
              const tab = tabs.find((item) => item.id === action.data?.node);
              // Keep the tab open until the parent drops it, so the panel can save before it unmounts
              if (tab) {
                tab.onRequestClose();
                return undefined;
              }
            }
            return action;
          }}
        />
      </div>
    </section>
  );
}
