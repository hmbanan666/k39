declare module '#auth-utils' {
  interface User {
    id: string
    email: string
  }

  interface UserYandex {
    id: string
    login: string
    client_id: string
    default_email: string
    emails: string[]
    display_name: string
    real_name: string
    first_name: string
    last_name: string
    sex: string
    default_avatar_id: string
    is_avatar_empty: boolean
    psuid: string
  }

  interface UserVK {
    user: {
      user_id: string
      first_name: string
      last_name: string
      avatar: string
      email: string
      sex: number
      verified: boolean
      birthday: string
    }
  }
}

export {}
