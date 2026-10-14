import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { signToken } from '../utils/jwt.js';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().trim().email('Enter a valid email').max(120),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt });

export async function register(req, res) {
  const data = registerSchema.parse(req.body);
  const email = data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }
  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: { name: data.name, email, passwordHash },
  });
  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
}

export async function login(req, res) {
  const data = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  res.json({ token: signToken(user.id), user: publicUser(user) });
}
