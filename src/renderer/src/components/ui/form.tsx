import * as React from 'react'
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues
} from 'react-hook-form'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'

const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue)

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext.name })
  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error('useFormField should be used within <FormField>')
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState
  }
}

interface FormItemProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function FormItem({ children, className, sx }: FormItemProps) {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <FormControl
        fullWidth
        className={className}
        sx={{
          display: 'grid',
          gap: 1,
          mb: 2,
          ...sx
        }}
      >
        {children}
      </FormControl>
    </FormItemContext.Provider>
  )
}

interface FormLabelProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function FormLabelComponent({ children, className, sx }: FormLabelProps) {
  const { error, formItemId } = useFormField()

  return (
    <FormLabel
      htmlFor={formItemId}
      error={!!error}
      className={className}
      sx={{
        fontSize: '0.875rem',
        fontWeight: 500,
        ...sx
      }}
    >
      {children}
    </FormLabel>
  )
}

interface FormControlProps {
  children?: React.ReactNode
}

function FormControlComponent({ children }: FormControlProps) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  // Clone children and add props
  if (React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{
      id?: string
      'aria-describedby'?: string
      'aria-invalid'?: boolean
      error?: boolean
    }>, {
      id: formItemId,
      'aria-describedby': !error
        ? formDescriptionId
        : `${formDescriptionId} ${formMessageId}`,
      'aria-invalid': !!error,
      error: !!error
    })
  }

  return <>{children}</>
}

interface FormDescriptionProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function FormDescription({ children, className, sx }: FormDescriptionProps) {
  const { formDescriptionId } = useFormField()

  return (
    <Typography
      id={formDescriptionId}
      variant="caption"
      color="text.secondary"
      className={className}
      sx={sx}
    >
      {children}
    </Typography>
  )
}

interface FormMessageProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function FormMessage({ children, className, sx }: FormMessageProps) {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message ?? '') : children

  if (!body) {
    return null
  }

  return (
    <FormHelperText
      id={formMessageId}
      error
      className={className}
      sx={sx}
    >
      {body}
    </FormHelperText>
  )
}

export {
  useFormField,
  Form,
  FormItem,
  FormLabelComponent as FormLabel,
  FormControlComponent as FormControl,
  FormDescription,
  FormMessage,
  FormField
}

export type {
  FormItemProps,
  FormLabelProps,
  FormControlProps,
  FormDescriptionProps,
  FormMessageProps
}
