const { z } = require("zod");

function charLength(value) {
  return Array.from(String(value || "")).length;
}

const className = z
  .string({ required_error: "请填写班级名称" })
  .trim()
  .min(1, "班级名称不能为空")
  .refine((value) => charLength(value) <= 10, "班级名称最多 10 个字符");

const username = z
  .string({ required_error: "请填写管理员账号" })
  .trim()
  .min(3, "管理员账号至少 3 个字符")
  .max(32, "管理员账号最多 32 个字符")
  .regex(/^[A-Za-z0-9_]+$/, "管理员账号只能包含字母、数字和下划线");

const password = z
  .string({ required_error: "请填写密码" })
  .min(6, "密码至少 6 个字符")
  .max(72, "密码最多 72 个字符");

const displayName = z.string().trim().max(32, "显示名称最多 32 个字符").optional().default("");

const registerSchema = z.object({
  className,
  adminUsername: username,
  adminPassword: password,
  adminDisplayName: displayName,
  registrationCode: z.string({ required_error: "请填写注册码" }).trim().min(1, "请填写注册码").max(64, "注册码格式不正确")
});

const localRegisterSchema = z.object({
  className,
  adminUsername: username,
  adminPassword: password,
  adminDisplayName: displayName
});

const classLoginSchema = z.object({
  username,
  password: z.string().min(1, "请输入密码").max(72)
});

const superLoginSchema = z.object({
  username: z.string().trim().min(1, "请输入账号").max(64),
  password: z.string().min(1, "请输入密码").max(72)
});

const guestLoginSchema = z.object({
  accessToken: z.string().trim().min(16, "令牌格式不正确").max(128)
});

const stateSchema = z.object({
  payload: z.object({}).passthrough(),
  revision: z.number().int().nonnegative().optional()
});

const tokenCreateSchema = z.object({
  label: z.string().trim().max(64, "备注最多 64 个字符").optional().default(""),
  expiresInDays: z.union([z.number(), z.string(), z.null()]).optional()
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "请输入当前密码").max(72),
  newPassword: password
});

const superClassUpdateSchema = z
  .object({
    name: className.optional(),
    status: z.enum(["active", "disabled"]).optional()
  })
  .refine((value) => value.name !== undefined || value.status !== undefined, "没有需要修改的字段");

const resetPasswordSchema = z.object({
  password
});

const accountCreateSchema = z.object({
  role: z.enum(["admin", "member"], { errorMap: () => ({ message: "账号类型不正确" }) }),
  username,
  password,
  displayName
});

const accountUpdateSchema = z.object({
  username: username.optional(),
  displayName: displayName.optional(),
  password: password.optional()
}).refine((value) => value.username !== undefined || value.displayName !== undefined || value.password !== undefined, "没有需要修改的字段");

const registrationCodeCreateSchema = z.object({
  note: z.string().trim().max(100, "备注最多 100 个字符").optional().default(""),
  maxUses: z.union([z.number(), z.string()]).optional().default(1),
  expiresInDays: z.union([z.number(), z.string(), z.null()]).optional()
});

function validateBody(schema) {
  return function validate(req, res, next) {
    const result = schema.safeParse(req.body || {});
    if (!result.success) {
      const first = result.error.issues[0];
      return res.status(400).json({
        error: "validation_error",
        message: first ? first.message : "请求参数不正确",
        field: first && first.path ? first.path.join(".") : undefined
      });
    }
    req.validated = result.data;
    next();
  };
}

module.exports = {
  charLength,
  registerSchema,
  localRegisterSchema,
  classLoginSchema,
  superLoginSchema,
  guestLoginSchema,
  stateSchema,
  tokenCreateSchema,
  changePasswordSchema,
  superClassUpdateSchema,
  resetPasswordSchema,
  registrationCodeCreateSchema,
  accountCreateSchema,
  accountUpdateSchema,
  validateBody
};
