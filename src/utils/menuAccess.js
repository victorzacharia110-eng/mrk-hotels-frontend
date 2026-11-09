/**
 * Who may maintain the menu.
 *
 * Menu maintenance is a back-office management function: admins and managers
 * only. Cashiers and bartenders run the floor and must not be able to change
 * dishes, prices or groups from the till panel.
 *
 * This list mirrors the route guard and MenuListPage's own gate. Keep all three
 * in step so a role can never be shown an editable page it is then refused.
 */
export const MENU_MANAGER_ROLES = Object.freeze([
  'hotel_admin',
  'manager',
])

/**
 * Whether a user (or a bare role string) may maintain the menu.
 *
 * @param {{ user_role?: string } | string | null | undefined} user
 * @returns {boolean}
 */
export function canManageMenu(user) {
  const role = typeof user === 'string' ? user : user?.user_role
  return MENU_MANAGER_ROLES.includes(role)
}