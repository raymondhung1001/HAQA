import { Hono } from 'hono'
import { UserController } from '@/controller/userController'

const userRoutes = new Hono()
const userController = new UserController()

userRoutes.get('/', userController.getAllUsers)

export default userRoutes