/**
 * Who may maintain the menu.
 *
 * The menu is owned by admins, managers and kitchen (back-office work, unlike
 * floor operations which exclude those roles). Cashiers and bartenders are in
 * too — they work a till on their own department all day and are the ones who
 * notice a dish missing, a price wrong or a group in the wrong place, so they
 * can fix it rather than report it.
 *
 * This list is the single source of truth. It has to stay in step with the
 * `CanManageMenu` policy on the API and the `level:30` on the menu write routes,
 * and it previously lived inline in MenuListPage while three comments in three
 * different files each claimed to be the thing that had to be kept in step. A
 * link that decides whether to show the menu at all now reads it from here, so a
 * role added below cannot be editable-but-unreachable.
 */
export const MENU_MANAGER_ROLES = Object.freeze([
  'hotel_admin',
  'manager',
  'kitchen',
  'cashier',
  'bartender',
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