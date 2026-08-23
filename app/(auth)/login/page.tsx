import { signInWithEmail } from "../actions";

export default function LoginPage() {
  return (
    <form action={async (fd) => { "use server"; await signInWithEmail(fd); }}>
      <input name="email" type="email" placeholder="Work email" required />
      <input name="password" type="password" placeholder="Password" required minLength={8} />
      <button type="submit">Log in</button>
    </form>
  );
}
