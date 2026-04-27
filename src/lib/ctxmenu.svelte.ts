export type ContextMenuItem = {
  label: string;
  onClick: () => void;
  danger?: boolean;
};

function createContextMenu() {
  let visible = $state(false);
  let x = $state(0);
  let y = $state(0);
  let items = $state<ContextMenuItem[]>([]);

  return {
    get visible() {
      return visible;
    },
    get x() {
      return x;
    },
    get y() {
      return y;
    },
    get items() {
      return items;
    },
    open(clientX: number, clientY: number, menuItems: ContextMenuItem[]) {
      x = clientX;
      y = clientY;
      items = menuItems;
      visible = true;
    },
    close() {
      visible = false;
    }
  };
}

export const contextMenu = createContextMenu();
