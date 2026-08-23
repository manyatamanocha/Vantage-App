import { signUpWithEmail } from "../actions";

export default function SignUpPage() {
  return (
    <form action={async (fd) => { "use server"; await signUpWithEmail(fd); }}>
      <input name="email" type="email" placeholder="Work email" required />
      <input name="password" type="password" placeholder="Password" required minLength={8} />
      <button type="submit">Sign up</button>
    </form>
  );
}
