export const userPages = { list: 'WebUserList', editor: 'WebUserEdit' } as const;

export const userActions = {
  new: 'WebAddUser',
  edit: 'WebEditUser',
  view: 'WebViewUser',
  delete: 'WebDeleteUser',
  export: 'WebExportUsers',
  save: 'WebSaveUser',
} as const;

export const userRelatedPages = {
  roles: { label: 'Roles', page: 'WebUserRolesList', action: 'WebListUserRoles' },
  accessModels: { label: 'AccessModels', page: 'WebAccessModelTreeList', action: 'WebListUserAccessModels' },
} as const;
export type UserRelatedPage = keyof typeof userRelatedPages;
