variable "name_prefix" {
  description = "Name prefix for Cognito resources."
  type        = string
}

variable "role_names" {
  description = "Cognito groups used for role-based library access."
  type        = list(string)
}

variable "tags" {
  description = "Tags applied to auth resources."
  type        = map(string)
}
